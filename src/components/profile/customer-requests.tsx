import { CancelRequestButton } from "@/components/profile/cancel-request-button";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate, formatStatusLabel, getStatusStyle } from "@/lib/admin-project-constants";
import {
  displaySlug,
  formatRequestBudget,
  formatRequestDeadline,
  formatClientRequestStatusLabel,
  formatYesNo,
  getRequestStatusStyle,
} from "@/lib/admin-project-request-constants";
import type { CustomerProjectRequestItem } from "@/lib/customer-project-requests";
import { formatMoney } from "@/lib/quote-money";
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

function RequestCard({ item }: { item: CustomerProjectRequestItem }) {
  const { request, linkedProject, quote, canCancel } = item;
  const features = request.required_features ?? [];
  const designBits = [
    request.has_design != null ? `Design: ${formatYesNo(request.has_design)}` : null,
    request.design_style ? displaySlug(request.design_style) : null,
    request.has_logo != null ? `Logo: ${formatYesNo(request.has_logo)}` : null,
    request.has_brand_colors != null
      ? `Brand colors: ${formatYesNo(request.has_brand_colors)}`
      : null,
    request.brand_colors,
  ].filter((value): value is string => Boolean(value));

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
          <p className="mt-1 text-xs text-muted">
            Submitted {formatDate(request.submitted_at)}
          </p>
        </div>
        {canCancel ? (
          <CancelRequestButton
            requestId={request.id}
            requestNumber={request.request_number}
          />
        ) : null}
      </div>

      {request.description ? (
        <p className="whitespace-pre-line text-sm leading-6 text-muted">{request.description}</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Detail label="Page count" value={request.page_count ?? "Not specified"} />
        <Detail
          label="Budget"
          value={formatRequestBudget(
            request.budget_min,
            request.budget_max,
            request.budget_currency,
          )}
        />
        <Detail
          label="Deadline"
          value={formatRequestDeadline(request.deadline_date, request.deadline_type)}
        />
        <Detail
          label="Design"
          value={designBits.length > 0 ? designBits.join(" · ") : "Not specified"}
        />
      </div>

      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted">
          Required features
        </p>
        {features.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {features.map((feature) => (
              <span
                key={feature}
                className="rounded-full border border-card-border px-2.5 py-1 text-xs text-muted"
              >
                {displaySlug(feature)}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-sm text-foreground">None selected</p>
        )}
      </div>

      {quote ? (
        <div className="rounded-lg border border-card-border px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted">Quote</p>
          <p className="mt-1 text-sm font-medium">
            {formatMoney(Number(quote.total), quote.currency)}
            <span className="ml-2 text-xs font-normal text-muted">
              Version {quote.version} · {quote.status.replace(/_/g, " ")}
            </span>
          </p>
        </div>
      ) : null}

      {linkedProject ? (
        <div className="flex flex-col gap-3 rounded-lg border border-card-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted">
              Linked project
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{linkedProject.project_number}</span>
              <Badge className={getStatusStyle(linkedProject.status)}>
                {formatStatusLabel(linkedProject.status)}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted">{linkedProject.title}</p>
          </div>
          <ButtonLink
            href={`/profile/projects/${linkedProject.id}`}
            variant="secondary"
            className="h-10 px-4 text-xs"
          >
            View project
          </ButtonLink>
        </div>
      ) : null}
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
