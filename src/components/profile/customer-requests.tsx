import { CancelRequestButton } from "@/components/profile/cancel-request-button";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/admin-project-constants";
import {
  displaySlug,
  formatRequestBudget,
  formatClientRequestStatusLabel,
  getRequestStatusStyle,
} from "@/lib/admin-project-request-constants";
import type { CustomerProjectRequestItem } from "@/lib/customer-project-requests";
import type { ProjectRequestRow } from "@/types/database";

function Detail({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  if (value == null || value === "") {
    return null;
  }

  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value}</p>
    </div>
  );
}

function requestTitle(request: ProjectRequestRow): string {
  const type = request.project_type?.trim();
  return type ? displaySlug(type) : "Project request";
}

function shortSummary(request: ProjectRequestRow): string | null {
  const text = request.description?.trim();
  if (!text) {
    return null;
  }
  if (text.length <= 160) {
    return text;
  }
  return `${text.slice(0, 157).trimEnd()}…`;
}

function RequestCard({ item }: { item: CustomerProjectRequestItem }) {
  const { request, canCancel, canResubmit } = item;
  const summary = shortSummary(request);
  const lastUpdated = request.updated_at || request.submitted_at;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-card-border bg-background p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold tracking-wider text-accent uppercase">
              {request.request_number}
            </span>
            <Badge className={getRequestStatusStyle(request.status)}>
              {formatClientRequestStatusLabel(request.status)}
            </Badge>
          </div>
          <h4 className="font-display text-lg tracking-tight font-medium">
            {requestTitle(request)}
          </h4>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink
            href={`/profile/project-requests/${request.id}`}
            variant="secondary"
            className="h-10 px-4 text-xs"
          >
            View Details
          </ButtonLink>
          {canResubmit ? (
            <ButtonLink
              href={`/profile/project-requests/${request.id}/edit`}
              className="h-10 px-4 text-xs"
            >
              Edit & Resubmit
            </ButtonLink>
          ) : null}
          {canCancel ? (
            <CancelRequestButton
              requestId={request.id}
              requestNumber={request.request_number}
            />
          ) : null}
        </div>
      </div>

      {summary ? (
        <p className="text-sm leading-6 text-muted">{summary}</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Detail label="Submitted" value={formatDate(request.submitted_at)} />
        <Detail
          label="Budget"
          value={formatRequestBudget(
            request.budget_min,
            request.budget_max,
            request.budget_currency || "BDT",
          )}
        />
        <Detail label="Last updated" value={formatDate(lastUpdated)} />
      </div>
    </div>
  );
}

export function CustomerRequests({
  items,
}: {
  items: CustomerProjectRequestItem[];
}) {
  const visible = items.filter((item) => !item.linkedProject);
  const emptyMessage =
    items.length === 0
      ? "You have not submitted a project request yet."
      : "Your converted requests now appear under Active Projects.";

  return (
    <Card className="hover:translate-y-0">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-xl tracking-tight">Project Requests</h3>
          <p className="mt-1 text-sm text-muted">
            Orders you submitted from the start-project form.
          </p>
        </div>
        <Badge>
          {`${visible.length} ${visible.length === 1 ? "Request" : "Requests"}`}
        </Badge>
      </div>

      <div className="mt-6">
        {visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-card-border p-6 text-center">
            <p className="text-sm text-muted">{emptyMessage}</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {visible.map((item) => (
              <RequestCard key={item.request.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
