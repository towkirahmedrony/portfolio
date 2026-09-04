import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AdminPage } from "@/components/admin/admin-page";
import type { Database } from "@/types/database";

type ProjectRequestRow = Database["public"]["Tables"]["project_requests"]["Row"];
type RequestStatus = ProjectRequestRow["status"];

const STATUS_STYLES: Record<RequestStatus, string> = {
  new: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  reviewing: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  quoted: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  approved: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  rejected: "bg-red-500/10 text-red-600 border-red-500/20",
  converted: "bg-teal-500/10 text-teal-600 border-teal-500/20",
  cancelled: "bg-neutral-500/10 text-neutral-500 border-neutral-500/20",
};

const STATUS_FILTERS: Array<{ label: string; value: RequestStatus | "all" }> = [
  { label: "All", value: "all" },
  { label: "New", value: "new" },
  { label: "Reviewing", value: "reviewing" },
  { label: "Quoted", value: "quoted" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "Converted", value: "converted" },
  { label: "Cancelled", value: "cancelled" },
];

function formatBudget(min: number | null, max: number | null, currency: string) {
  if (min == null && max == null) return "Not specified";
  if (min != null && max != null) {
    return `${currency} ${min.toLocaleString()} \u2013 ${max.toLocaleString()}`;
  }
  return `${currency} ${(min ?? max)!.toLocaleString()}+`;
}

export default async function AdminProjectRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const { status } = await searchParams;
  const supabase = await createServerSupabaseClient();

  let query = supabase
    .from("project_requests")
    .select("*")
    .order("submitted_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status as RequestStatus);
  }

  const { data: requests, error } = await query;

  return (
    <AdminPage
      title="Project Requests"
      description="Incoming leads from the /start-project form. Review and move them into active projects."
    >
      <div className="mb-6 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={
              filter.value === "all"
                ? "/admin/project-requests"
                : `/admin/project-requests?status=${filter.value}`
            }
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              (status ?? "all") === filter.value
                ? "border-foreground bg-foreground text-background"
                : "border-card-border text-muted hover:text-foreground"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {error ? (
        <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-6 text-sm text-red-600">
          Failed to load project requests: {error.message}
        </div>
      ) : !requests || requests.length === 0 ? (
        <div className="rounded-3xl border border-card-border bg-card p-6 text-sm text-muted">
          No project requests found for this filter.
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-card-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-card-border text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Request</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Budget</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr
                  key={request.id}
                  className="border-b border-card-border/60 last:border-0 hover:bg-foreground/[0.02]"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/project-requests/${request.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {request.request_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-foreground">{request.full_name}</div>
                    <div className="text-xs text-muted">{request.email}</div>
                  </td>
                  <td className="px-4 py-3 text-muted">{request.project_type ?? "\u2014"}</td>
                  <td className="px-4 py-3 text-muted">
                    {formatBudget(request.budget_min, request.budget_max, request.budget_currency)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[request.status]}`}
                    >
                      {request.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(request.submitted_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminPage>
  );
}
