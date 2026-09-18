import Link from "next/link";
import { StatusPill } from "@/components/admin/projects/query-state";
import {
  displaySlug,
  formatDate,
  formatRequestBudget,
  formatRequestDeadline,
  formatRequestStatusLabel,
  getRequestStatusStyle,
  listClientName,
  type AdminProjectRequestListItem,
} from "@/lib/admin-project-requests";

function requestTitle(request: AdminProjectRequestListItem): string {
  return (
    displaySlug(request.project_type) !== "—"
      ? displaySlug(request.project_type)
      : request.description?.trim() || "Untitled request"
  );
}

export function ProjectRequestsListTable({
  requests,
}: {
  requests: AdminProjectRequestListItem[];
}) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-card-border bg-card">
      <table className="w-full min-w-[64rem] text-left text-sm">
        <thead className="border-b border-card-border text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3">Request</th>
            <th className="px-4 py-3">Client</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Budget</th>
            <th className="px-4 py-3">Deadline</th>
            <th className="px-4 py-3">Linked project</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Submitted</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => {
            const clientName = listClientName(request.client, request.full_name);
            return (
              <tr
                key={request.id}
                className="border-b border-card-border/60 last:border-0 hover:bg-foreground/[0.02]"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/project-requests/${request.id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {requestTitle(request)}
                  </Link>
                  <div className="mt-0.5 font-mono text-xs text-muted">
                    {request.request_number}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-foreground">Client: {clientName}</div>
                  {request.company_name ? (
                    <div className="text-xs text-muted">{request.company_name}</div>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-muted">{request.email}</td>
                <td className="px-4 py-3 text-muted">
                  {formatRequestBudget(
                    request.budget_min,
                    request.budget_max,
                    request.budget_currency || "BDT",
                  )}
                </td>
                <td className="px-4 py-3 text-muted">
                  {formatRequestDeadline(request.deadline_date, request.deadline_type)}
                </td>
                <td className="px-4 py-3 text-muted">
                  {request.linkedProject ? (
                    <Link
                      href={`/admin/projects/${request.linkedProject.id}`}
                      className="font-mono text-xs text-foreground hover:underline"
                    >
                      {request.linkedProject.project_number}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusPill
                    label={formatRequestStatusLabel(request.status)}
                    className={getRequestStatusStyle(request.status)}
                  />
                </td>
                <td className="px-4 py-3 text-muted">{formatDate(request.submitted_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
