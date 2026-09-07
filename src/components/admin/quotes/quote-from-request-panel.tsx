import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/admin/projects/action-form";
import { AdminPanel, StatusPill } from "@/components/admin/projects/query-state";
import { createQuoteDraftFromRequest } from "@/lib/admin-quote-actions";
import type { QuoteEligibleRequestListItem } from "@/lib/admin-quote-constants";
import {
  displaySlug,
  formatDate,
  formatRequestBudget,
  formatRequestDeadline,
  formatRequestStatusLabel,
  getRequestStatusStyle,
} from "@/lib/admin-project-request-constants";
import { clientDisplayName } from "@/lib/admin-project-constants";

function EligibleRequestRow({ request }: { request: QuoteEligibleRequestListItem }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-card-border bg-background p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/project-requests/${request.id}`}
            className="font-medium text-foreground hover:underline"
          >
            {request.request_number}
          </Link>
          <StatusPill
            label={formatRequestStatusLabel(request.status)}
            className={getRequestStatusStyle(request.status)}
          />
        </div>
        <div className="mt-1 text-sm text-foreground">
          {displaySlug(request.project_type) || "Project request"}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span>
            {clientDisplayName(request.client)} · {request.email}
          </span>
          <span>
            {formatRequestBudget(
              request.budget_min,
              request.budget_max,
              request.budget_currency || "BDT",
            )}
          </span>
          <span>Submitted {formatDate(request.submitted_at)}</span>
          {request.deadline_date || request.deadline_type ? (
            <span>
              Deadline {formatRequestDeadline(request.deadline_date, request.deadline_type)}
            </span>
          ) : null}
        </div>
      </div>
      <ActionForm action={createQuoteDraftFromRequest} className="shrink-0">
        <input type="hidden" name="requestId" value={request.id} />
        <SubmitButton pendingLabel="Creating…" className="bg-foreground text-background">
          Create quote
        </SubmitButton>
      </ActionForm>
    </div>
  );
}

export function QuoteFromRequestPanel({
  requests,
}: {
  requests: QuoteEligibleRequestListItem[];
}) {
  return (
    <AdminPanel
      title="Quote from a project request"
      description="Open client orders that have not been converted yet. Creating a quote approves the request, converts it into its single project record (never a duplicate), and opens a prefilled draft — the submitted budget is only a suggested starting amount."
    >
      {requests.length === 0 ? (
        <p className="text-sm text-muted">
          No open project requests are waiting to be quoted. New submissions appear here
          after review; converted requests are quoted from their project.
        </p>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <EligibleRequestRow key={request.id} request={request} />
          ))}
        </div>
      )}
    </AdminPanel>
  );
}
