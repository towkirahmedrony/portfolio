import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { FileDownloader } from "@/components/profile/file-downloader";

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

export default async function ProjectDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return notFound();

  const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).eq("client_id", user.id).single();
  if (!project) return notFound();

  const [ { data: milestones }, { data: invoices }, { data: reqData }, { data: files }, { data: history }, { data: discounts } ] = await Promise.all([
    supabase.from("project_milestones").select("*").eq("project_id", projectId).order("sort_order"),
    supabase.from("invoices").select("*").eq("project_id", projectId),
    supabase.from("project_requirements").select("*").eq("project_id", projectId),
    supabase.from("project_files").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    supabase.from("project_status_history").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    supabase.from("project_discounts").select("*").eq("project_id", projectId)
  ]);

  const totalPaid = (invoices as InvoiceRow[])?.reduce((sum, inv) => sum + Number(inv.amount_paid || 0), 0) || 0;
  const totalDue = (invoices as InvoiceRow[])?.reduce((sum, inv) => sum + Number(inv.amount_due || 0), 0) || 0;
  const baseBudget = project.agreed_price || project.estimated_budget || 0;
  const requirements = reqData && reqData.length > 0 ? (reqData[0] as RequirementRow) : null;

  return (
    <div className="mx-auto max-w-4xl pt-28 pb-12 sm:pt-32 px-5 sm:px-8">
      <Link href="/profile" className="mb-8 inline-block text-sm text-muted hover:text-accent">&larr; Back to Profile</Link>
      
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold tracking-wider text-accent uppercase">{project.project_number}</span>
            <Badge>{project.status.replace("_", " ")}</Badge>
            {project.priority && <Badge className="border-accent/20">{`Priority: ${project.priority}`}</Badge>}
          </div>
          <h1 className="font-display mt-2 text-3xl tracking-tight sm:text-4xl">{project.title}</h1>
          {project.description && <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{project.description}</p>}
        </div>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:translate-y-0 flex flex-col justify-between">
          <div>
            <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">Financial Overview</p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted">Total Budget:</span><span className="font-medium">{`${baseBudget} ${project.currency}`}</span></div>
              {(discounts as DiscountRow[])?.map(d => (
                <div key={d.id} className="flex justify-between text-emerald-500"><span>{`Discount (${d.label}):`}</span><span className="font-medium">{`-${d.discount_amount} ${d.currency}`}</span></div>
              ))}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-card-border space-y-1">
            <div className="flex justify-between text-sm"><span className="text-muted">Amount Paid:</span><span className="font-medium text-accent">{`${totalPaid} ${project.currency}`}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted">Amount Due:</span><span className="font-medium text-destructive">{`${totalDue} ${project.currency}`}</span></div>
          </div>
        </Card>

        <Card className="hover:translate-y-0 flex flex-col justify-between">
          <div>
             <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">Timeline</p>
             <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted">Start Date:</span><span className="font-medium">{project.start_date ? new Date(project.start_date).toLocaleDateString() : "TBD"}</span></div>
                <div className="flex justify-between"><span className="text-muted">Target Delivery:</span><span className="font-medium">{project.due_date ? new Date(project.due_date).toLocaleDateString() : "TBD"}</span></div>
             </div>
          </div>
          {(project.completed_at || project.cancelled_at) && (
            <div className="mt-4 pt-3 border-t border-card-border">
              <div className="flex justify-between text-sm">
                <span className="text-muted">{project.completed_at ? "Completed:" : "Cancelled:"}</span>
                <span className="font-medium">{new Date((project.completed_at || project.cancelled_at) as string).toLocaleDateString()}</span>
              </div>
            </div>
          )}
        </Card>

        <Card className="hover:translate-y-0">
          <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">Scope & Requirements</p>
          {requirements ? (
            <div className="mt-4 space-y-2 text-sm">
              <p><span className="text-muted">Pages:</span> {`${requirements.pages || "N/A"}`}</p>
              {requirements.scope && <p className="text-muted line-clamp-2">{requirements.scope}</p>}
              {Array.isArray(requirements.features) && requirements.features.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {requirements.features.slice(0, 3).map((f: string, i: number) => <Badge key={i} className="text-[10px]">{f}</Badge>)}
                  {requirements.features.length > 3 && <Badge className="text-[10px]">{`+${requirements.features.length - 3} more`}</Badge>}
                </div>
              )}
            </div>
          ) : <p className="mt-4 text-sm text-muted">Scope details not finalized yet.</p>}
        </Card>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          <Card className="hover:translate-y-0">
            <h3 className="font-display text-xl tracking-tight">Project Milestones</h3>
            {(!milestones || milestones.length === 0) ? (
              <p className="mt-4 text-sm text-muted text-center py-6 border border-dashed border-card-border rounded-xl">No milestones set yet.</p>
            ) : (
              <div className="mt-6 space-y-4">
                {(milestones as MilestoneRow[]).map((m, index) => (
                  <div key={m.id} className="flex flex-col sm:flex-row sm:items-start gap-4 rounded-xl border border-card-border p-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent font-semibold text-sm">{index + 1}</div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-medium text-base">{m.title}</h4>
                        <Badge>{m.status.replace("_", " ")}</Badge>
                      </div>
                      {m.description && <p className="mt-1 text-sm text-muted">{m.description}</p>}
                      {m.due_date && <p className="mt-2 text-xs text-muted font-medium">{`Due: ${new Date(m.due_date).toLocaleDateString()}`}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="hover:translate-y-0">
            <h3 className="font-display text-xl tracking-tight">Project Files</h3>
            {(!files || files.length === 0) ? (
              <p className="mt-4 text-sm text-muted text-center py-6 border border-dashed border-card-border rounded-xl">No files uploaded yet.</p>
            ) : (
              <div className="mt-6 divide-y divide-card-border">
                {(files as FileRow[]).map((file) => (
                  <div key={file.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">{file.original_name}</p>
                      <p className="text-xs text-muted flex gap-2 mt-1"><span className="capitalize">{file.category}</span><span>•</span><span>{formatBytes(file.file_size_bytes)}</span></p>
                    </div>
                    <FileDownloader bucketName={file.bucket_name} storagePath={file.storage_path} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="hover:translate-y-0 h-full">
            <h3 className="font-display text-xl tracking-tight mb-6">Status History</h3>
            {(!history || history.length === 0) ? (
               <p className="text-sm text-muted">No timeline events recorded yet.</p>
            ) : (
              <div className="relative border-l border-card-border ml-3 space-y-6">
                {(history as HistoryRow[]).map((h) => (
                  <div key={h.id} className="relative pl-6">
                    <span className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full bg-accent ring-4 ring-background" />
                    <p className="text-sm font-medium capitalize">{h.to_status.replace("_", " ")}</p>
                    {h.note && <p className="text-sm text-muted mt-1">{h.note}</p>}
                    <p className="text-xs text-muted/60 mt-1">{new Date(h.created_at).toLocaleString()}</p>
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
