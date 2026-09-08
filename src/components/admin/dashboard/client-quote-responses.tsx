import { EmptyNotice, QueryNotice } from "@/components/admin/dashboard/query-notice";
import type { ClientQuoteResponseItem } from "@/lib/admin-quote-responses";
import type { DashboardQueryState } from "@/lib/admin-dashboard";

function actionLabel(action: ClientQuoteResponseItem["action"]): string {
  switch (action) {
    case "accepted":
      return "Accepted";
    case "rejected":
      return "Rejected";
    case "change_requested":
      return "Requested changes";
  }
}

function actionColor(action: ClientQuoteResponseItem["action"]): string {
  switch (action) {
    case "accepted":
      return "text-emerald-600 dark:text-emerald-400";
    case "rejected":
      return "text-red-600 dark:text-red-400";
    case "change_requested":
      return "text-amber-600 dark:text-amber-400";
  }
}

function referenceLabel(item: ClientQuoteResponseItem): string {
  if (item.projectNumber && item.requestNumber) {
    return `${item.projectNumber} · ${item.requestNumber}`;
  }
  return item.projectNumber ?? item.requestNumber ?? "No linked request";
}

function formatResponseTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

export function ClientQuoteResponses({
  responses,
}: {
  responses: DashboardQueryState<ClientQuoteResponseItem[]>;
}) {
  if (responses.status === "error" || responses.status === "unavailable") {
    return (
      <div className="rounded-3xl border border-card-border bg-card p-6">
        <QueryNotice state={responses} />
      </div>
    );
  }

  if (responses.status === "empty") {
    return (
      <div className="rounded-3xl border border-dashed border-card-border bg-card p-6">
        <EmptyNotice>No client quote responses yet.</EmptyNotice>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-card-border bg-card">
      <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.4fr)_9.5rem] gap-4 border-b border-card-border px-6 py-3 text-xs font-medium tracking-[0.14em] text-muted uppercase sm:grid">
        <span>Client</span>
        <span>Response</span>
        <span>Quote / request</span>
        <span>Time</span>
      </div>
      <ul className="divide-y divide-card-border">
        {responses.data.map((item) => (
          <li key={item.id} className="px-6 py-4">
            <div className="grid gap-1 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.4fr)_9.5rem] sm:items-start sm:gap-4">
              <p className="truncate text-sm font-medium">
                {item.clientName ?? "Client"}
              </p>
              <p className={`truncate text-sm font-medium ${actionColor(item.action)}`}>
                {actionLabel(item.action)}
              </p>
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">
                  Quote v{item.quoteVersion} · {referenceLabel(item)}
                </p>
                {item.message ? (
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">
                    {item.message}
                  </p>
                ) : null}
              </div>
              <p className="text-xs text-muted sm:text-right">
                {formatResponseTime(item.createdAt)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
