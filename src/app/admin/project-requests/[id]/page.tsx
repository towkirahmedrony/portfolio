import { notFound } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AdminPage } from "@/components/admin/admin-page";
import type { Database } from "@/types/database";

type RequestStatus = Database["public"]["Tables"]["project_requests"]["Row"]["status"];

const STATUS_OPTIONS: RequestStatus[] = [
  "new",
  "reviewing",
  "quoted",
  "approved",
  "rejected",
  "converted",
  "cancelled",
];

export default async function ProjectRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: request, error } = await supabase
    .from("project_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !request) {
    notFound();
  }

  async function updateStatus(formData: FormData) {
    "use server";
    await requireAdmin();
    const nextStatus = formData.get("status") as RequestStatus;
    const supabase = await createServerSupabaseClient();
    await supabase.from("project_requests").update({ status: nextStatus }).eq("id", id);
    revalidatePath(`/admin/project-requests/${id}`);
    revalidatePath("/admin/project-requests");
  }

  return (
    <AdminPage
      title={request.request_number}
      description={`Submitted ${new Date(request.submitted_at).toLocaleString()} by ${request.full_name}`}
    >
      <Link
        href="/admin/project-requests"
        className="mb-6 inline-block text-sm text-muted hover:text-foreground"
      >
        \u2190 Back to all requests
      </Link>

      <div className="grid gap-6 md:grid-cols-3">
        <section className="space-y-6 md:col-span-2">
          <div className="rounded-3xl border border-card-border bg-card p-6">
            <h3 className="font-display text-lg text-foreground">Client</h3>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted">Name</dt>
                <dd className="text-foreground">{request.full_name}</dd>
              </div>
              <div>
                <dt className="text-muted">Email</dt>
                <dd className="text-foreground">{request.email}</dd>
              </div>
              <div>
                <dt className="text-muted">Phone</dt>
                <dd className="text-foreground">{request.phone ?? "\u2014"}</dd>
              </div>
              <div>
                <dt className="text-muted">Company</dt>
                <dd className="text-foreground">{request.company_name ?? "\u2014"}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-3xl border border-card-border bg-card p-6">
            <h3 className="font-display text-lg text-foreground">Project</h3>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted">Type</dt>
                <dd className="text-foreground">{request.project_type ?? "\u2014"}</dd>
              </div>
              <div>
                <dt className="text-muted">Website status</dt>
                <dd className="text-foreground">{request.website_status ?? "\u2014"}</dd>
              </div>
              <div>
                <dt className="text-muted">Pages</dt>
                <dd className="text-foreground">{request.page_count ?? "\u2014"}</dd>
              </div>
              <div>
                <dt className="text-muted">Deadline</dt>
                <dd className="text-foreground">
                  {request.deadline_date ?? request.deadline_type ?? "\u2014"}
                </dd>
              </div>
            </dl>
            {request.description && (
              <div className="mt-4">
                <dt className="text-sm text-muted">Description</dt>
                <p className="mt-1 whitespace-pre-line text-sm text-foreground">
                  {request.description}
                </p>
              </div>
            )}
            {request.required_features && request.required_features.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {request.required_features.map((feature) => (
                  <span
                    key={feature}
                    className="rounded-full border border-card-border px-2.5 py-1 text-xs text-muted"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-card-border bg-card p-6">
            <h3 className="font-display text-lg text-foreground">Design</h3>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted">Has existing design</dt>
                <dd className="text-foreground">{request.has_design ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-muted">Style</dt>
                <dd className="text-foreground">{request.design_style ?? "\u2014"}</dd>
              </div>
              <div>
                <dt className="text-muted">Has logo</dt>
                <dd className="text-foreground">{request.has_logo ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-muted">Brand colors</dt>
                <dd className="text-foreground">{request.brand_colors ?? "\u2014"}</dd>
              </div>
            </dl>
            {request.figma_url && (
              <p className="mt-3 text-sm">
                <a href={request.figma_url} target="_blank" rel="noreferrer" className="text-foreground underline">
                  View Figma \u2192
                </a>
              </p>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-card-border bg-card p-6">
            <h3 className="font-display text-lg text-foreground">Budget</h3>
            <p className="mt-2 text-sm text-foreground">
              {request.budget_min || request.budget_max
                ? `${request.budget_currency} ${request.budget_min ?? "?"} \u2013 ${request.budget_max ?? "?"}`
                : "Not specified"}
            </p>
          </div>

          <div className="rounded-3xl border border-card-border bg-card p-6">
            <h3 className="font-display text-lg text-foreground">Status</h3>
            <form action={updateStatus} className="mt-4 flex flex-col gap-3">
              <select
                name="status"
                defaultValue={request.status}
                className="rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background"
              >
                Update status
              </button>
            </form>
          </div>

          {request.referral_code_entered && (
            <div className="rounded-3xl border border-card-border bg-card p-6">
              <h3 className="font-display text-lg text-foreground">Referral</h3>
              <p className="mt-2 text-sm text-foreground">{request.referral_code_entered}</p>
              <p className="text-xs text-muted">
                {request.referral_code_id ? "Resolved" : "Not yet resolved to a code"}
              </p>
            </div>
          )}
        </aside>
      </div>
    </AdminPage>
  );
}
