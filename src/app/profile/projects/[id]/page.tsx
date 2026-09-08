import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ClientQuoteSection } from "@/components/profile/client-quote-section";
import { FileDownloader } from "@/components/profile/file-downloader";
import {
  formatClientProjectStatusLabel,
  getStatusStyle,
} from "@/lib/admin-project-constants";
import {
  formatClientRequestStatusLabel,
  formatRequestBudget,
  getRequestStatusStyle,
} from "@/lib/admin-project-request-constants";
import {
  formatClientQuoteStatusLabel,
  getQuoteStatusStyle,
} from "@/lib/admin-quote-constants";
import { getCustomerProjectDetail } from "@/lib/customer-project-requests";
import { markOwnQuoteViewed } from "@/lib/customer-quote-actions";
import { formatMoney } from "@/lib/quote-money";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type MilestoneRow = { id: string; title: string; description: string | null; status: string; due_date: string | null; };
type InvoiceRow = { id: string; total: number; amount_paid: number; amount_due: number; status: string; currency: string; };
type RequirementRow = { id: string; scope: string; pages: number; features: unknown; constraints: string; };
type FileRow = { id: string; original_name: string; category: string; file_size_bytes: number; created_at: string; bucket_name: string; storage_path: string; is_public: boolean; };
type HistoryRow = { id: string; to_status: string; note: string; created_at: string; };
type DiscountRow = { id: string; label: string; discount_amount: number; currency: string; };

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProjectDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let detail = await getCustomerProjectDetail(user.id, projectId);
  if (!detail) return notFound();

  if (detail.quote?.status === "sent") {
    await markOwnQuoteViewed(detail.quote.id);
    detail = (await getCustomerProjectDetail(user.id, projectId)) ?? detail;
  }

  const project = detail.project;
  const [ { data: milestones }, { data: invoices }, { data: reqData }, { data: files }, { data: history }, { data: discounts }, { count: unreadMessageCount } ] = await Promise.all([
    supabase.from("project_milestones").select("*").eq("project_id", projectId).order("sort_order"),
    supabase.from("invoices").select("*").eq("project_id", projectId),
    supabase.from("project_requirements").select("*").eq("project_id", projectId),
    supabase.from("project_files").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    supabase.from("project_status_history").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    supabase.from("project_discounts").select("*").eq("project_id", projectId),
    supabase.from("project_messages").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("is_read", false).neq("sender_id", user.id)
  ]);
  const unreadMessages = unreadMessageCount ?? 0;

  const totalPaid = (invoices as InvoiceRow[])?.reduce((sum, inv) => sum + Number(inv.amount_paid || 0), 0) || 0;
  const totalDue = (invoices as InvoiceRow[])?.reduce((sum, inv) => sum + Number(inv.amount_due || 0), 0) || 0;
  const submittedBudget = detail.request
    ? formatRequestBudget(
        detail.request.budget_min,
        detail.request.budget_max,
        detail.request.budget_currency || project.currency || "BDT",
      )
    : null;
  const quotedAmount = detail.quote
    ? formatMoney(detail.quote.total, detail.quote.currency)
    : "No admin quote yet";
  const invoiceAmount = (invoices as InvoiceRow[])?.reduce((sum, inv) => sum + Number(inv.total || 0), 0) || 0;
  const requirements = reqData && reqData.length > 0 ? (reqData[0] as RequirementRow) : null;

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl px-4 pt-24 pb-12 sm:px-6 sm:pt-28 lg:px-8">
      <Link href="/profile" className="mb-5 inline-block text-sm text-muted hover:text-accent sm:mb-8">&larr; Back to Profile</Link>

      {/* Header — stacked on mobile so nothing is squeezed into one row. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="text-xs font-semibold tracking-wider text-accent uppercase">{project.project_number}</span>
            {detail.request ? (
              <Badge className={getRequestStatusStyle(detail.request.status)}>
                {`Request: ${formatClientRequestStatusLabel(detail.request.status)}`}
              </Badge>
            ) : null}
            <Badge className={getStatusStyle(project.status)}>
              {`Project: ${formatClientProjectStatusLabel(project.status)}`}
            </Badge>
            {detail.quote ? (
              <Badge className={getQuoteStatusStyle(detail.quote.status)}>
                {`Quote: ${formatClientQuoteStatusLabel(detail.quote.status)}`}
              </Badge>
            ) : null}
            {project.priority && <Badge className="border-accent/20">{`Priority: ${project.priority}`}</Badge>}
          </div>
          <h1 className="font-display mt-2 break-words text-2xl tracking-tight sm:text-4xl">{project.title}</h1>
          {project.description && (
            <p className="mt-3 max-w-2xl break-words text-sm leading-6 text-muted">{project.description}</p>
          )}
        </div>
      </div>

      {project.status === "cancelled" ? (
        <div className="mt-6 flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <span className="text-xs text-muted">
            This project was cancelled, so new messages can&apos;t be sent. Past
            messages remain available.
          </span>
          <Link
            href={`/profile/projects/${project.id}/messages`}
            className="inline-flex items-center justify-center rounded-full border border-card-border bg-background px-4 py-2.5 text-center text-xs font-medium text-foreground transition-colors hover:border-accent/40 hover:text-accent sm:w-auto sm:py-2"
          >
            View past messages
          </Link>
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <ButtonLink
            href={`/profile/projects/${project.id}/messages`}
            variant="secondary"
            size="md"
            className="w-full justify-center sm:w-auto"
          >
            Chat with Admin &rarr;
          </ButtonLink>
          {unreadMessages > 0 ? (
            <span className="inline-flex items-center justify-center rounded-full bg-accent/10 px-3 py-1.5 text-center text-xs font-bold text-accent">
              {unreadMessages} new {unreadMessages === 1 ? "message" : "messages"}
            </span>
          ) : (
            <span className="text-xs text-muted">
              Live conversation about this project with the team
            </span>
          )}
        </div>
      )}

      <div className="mt-8 grid min-w-0 grid-cols-1 gap-4 sm:mt-10 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        <Card className="min-w-0 hover:translate-y-0 flex flex-col justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">Financial Overview</p>
            <div className="mt-4 space-y-2 text-sm">
              {submittedBudget ? (
                <div className="flex flex-wrap justify-between gap-x-3 gap-y-1"><span className="text-muted">Your submitted budget:</span><span className="min-w-0 font-medium break-words text-right">{submittedBudget}</span></div>
              ) : null}
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-1"><span className="text-muted">Current quote:</span><span className="min-w-0 font-medium break-words text-right">{quotedAmount}</span></div>
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-1"><span className="text-muted">Invoice amount:</span><span className="min-w-0 font-medium break-words text-right">{formatMoney(invoiceAmount, project.currency || "BDT")}</span></div>
              {(discounts as DiscountRow[])?.map(d => (
                <div key={d.id} className="flex flex-wrap justify-between gap-x-3 text-emerald-500"><span className="break-words">{`Discount (${d.label}):`}</span><span className="font-medium">{`-${d.discount_amount} ${d.currency}`}</span></div>
              ))}
            </div>
          </div>
          <div className="mt-4 space-y-1 border-t border-card-border pt-3">
            <div className="flex flex-wrap justify-between text-sm"><span className="text-muted">Amount Paid:</span><span className="min-w-0 font-medium break-words text-accent">{`${totalPaid} ${project.currency}`}</span></div>
            <div className="flex flex-wrap justify-between text-sm"><span className="text-muted">Amount Due:</span><span className="min-w-0 font-medium break-words text-destructive">{`${totalDue} ${project.currency}`}</span></div>
          </div>
        </Card>

        <Card className="min-w-0 hover:translate-y-0 flex flex-col justify-between">
          <div className="min-w-0">
             <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">Timeline</p>
             <div className="mt-4 space-y-2 text-sm">
                <div className="flex flex-wrap justify-between gap-x-3"><span className="text-muted">Start Date:</span><span className="min-w-0 font-medium break-words">{project.start_date ? new Date(project.start_date).toLocaleDateString() : "TBD"}</span></div>
                <div className="flex flex-wrap justify-between gap-x-3"><span className="text-muted">Target Delivery:</span><span className="min-w-0 font-medium break-words">{project.due_date ? new Date(project.due_date).toLocaleDateString() : "TBD"}</span></div>
             </div>
          </div>
          {(project.completed_at || project.cancelled_at) && (
            <div className="mt-4 border-t border-card-border pt-3">
              <div className="flex flex-wrap justify-between text-sm">
                <span className="text-muted">{project.completed_at ? "Completed:" : "Cancelled:"}</span>
                <span className="min-w-0 font-medium break-words">{new Date((project.completed_at || project.cancelled_at) as string).toLocaleDateString()}</span>
              </div>
            </div>
          )}
        </Card>

        <Card className="min-w-0 hover:translate-y-0">
          <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">Scope & Requirements</p>
          {requirements ? (
            <div className="mt-4 space-y-2 text-sm">
              <p className="break-words"><span className="text-muted">Pages:</span> {`${requirements.pages || "N/A"}`}</p>
              {requirements.scope && <p className="break-words text-muted line-clamp-2">{requirements.scope}</p>}
              {Array.isArray(requirements.features) && requirements.features.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {requirements.features.slice(0, 3).map((f: string, i: number) => <Badge key={i} className="max-w-full break-words text-[10px]">{f}</Badge>)}
                  {requirements.features.length > 3 && <Badge className="text-[10px]">{`+${requirements.features.length - 3} more`}</Badge>}
                </div>
              )}
            </div>
          ) : <p className="mt-4 text-sm text-muted">Scope details not finalized yet.</p>}
        </Card>
      </div>

      <div className="mt-10">
        <ClientQuoteSection
          quote={detail.quote}
          items={detail.quoteItems}
          invoices={detail.invoices}
          submittedBudget={submittedBudget}
          versions={detail.quoteVersions}
        />
      </div>

      <div className="mt-10 grid min-w-0 gap-8 lg:mt-12 lg:grid-cols-3">
        <div className="min-w-0 space-y-8 lg:col-span-2">
          <Card className="min-w-0 hover:translate-y-0">
            <h3 className="font-display text-lg tracking-tight sm:text-xl">Project Milestones</h3>
            {(!milestones || milestones.length === 0) ? (
              <p className="mt-4 border border-dashed border-card-border rounded-xl py-6 text-center text-sm text-muted">No milestones set yet.</p>
            ) : (
              <div className="mt-4 space-y-3 sm:mt-6 sm:space-y-4">
                {(milestones as MilestoneRow[]).map((m, index) => (
                  <div key={m.id} className="flex flex-col gap-3 rounded-xl border border-card-border p-3.5 sm:flex-row sm:items-start sm:gap-4 sm:p-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent">{index + 1}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="min-w-0 break-words text-base font-medium">{m.title}</h4>
                        <Badge>{m.status.replace("_", " ")}</Badge>
                      </div>
                      {m.description && <p className="mt-1 break-words text-sm leading-6 text-muted">{m.description}</p>}
                      {m.due_date && <p className="mt-2 text-xs font-medium text-muted">{`Due: ${new Date(m.due_date).toLocaleDateString()}`}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="min-w-0 hover:translate-y-0">
            <h3 className="font-display text-lg tracking-tight sm:text-xl">Project Files</h3>
            {(!files || files.length === 0) ? (
              <p className="mt-4 border border-dashed border-card-border rounded-xl py-6 text-center text-sm text-muted">No files uploaded yet.</p>
            ) : (
              <div className="mt-4 divide-y divide-card-border sm:mt-6">
                {(files as FileRow[]).map((file) => (
                  <div key={file.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-medium">{file.original_name}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted"><span className="capitalize">{file.category}</span><span>•</span><span>{formatBytes(file.file_size_bytes)}</span></p>
                    </div>
                    <div className="shrink-0">
                      <FileDownloader bucketName={file.bucket_name} storagePath={file.storage_path} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="min-w-0 lg:col-span-1">
          <Card className="min-w-0 h-full hover:translate-y-0">
            <h3 className="font-display mb-5 text-lg tracking-tight sm:text-xl">Status History</h3>
            {(!history || history.length === 0) ? (
               <p className="text-sm text-muted">No timeline events recorded yet.</p>
            ) : (
              <div className="relative ml-3 space-y-6 border-l border-card-border">
                {(history as HistoryRow[]).map((h) => (
                  <div key={h.id} className="relative min-w-0 pl-6">
                    <span className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full bg-accent ring-4 ring-background" />
                    <p className="break-words text-sm font-medium capitalize">{h.to_status.replace("_", " ")}</p>
                    {h.note && <p className="mt-1 break-words text-sm leading-6 text-muted">{h.note}</p>}
                    <p className="mt-1 text-xs text-muted/60">{new Date(h.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
