import Link from "next/link";
import { EmptyNotice, QueryNotice } from "@/components/admin/dashboard/query-notice";
import type { ClientQuoteResponseItem } from "@/lib/admin-quote-responses";
import type { DashboardQueryState } from "@/lib/admin-dashboard";

function actionLabel(action: ClientQuoteResponseItem["action"]): string {
  switch (action) {
    case "accepted":
      return "Quote Accepted";
    case "rejected":
      return "Quote Rejected";
    case "change_requested":
      return "Quote Change Requested";
  }
}

function actionBadgeClass(action: ClientQuoteResponseItem["action"]): string {
  switch (action) {
    case "accepted":
      return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400";
    case "rejected":
      return "bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-400";
    case "change_requested":
      return "bg-amber-500/10 text-amber-700 border-amber-500/25 dark:text-amber-400";
  }
}

function responseRowClass(item: ClientQuoteResponseItem): string {
  if (item.action === "change_requested" && item.open) {
    return "border-l-4 border-l-amber-500 bg-amber-500/[0.04]";
  }
  return "";
}

function referenceCell(item: ClientQuoteResponseItem) {
  const parts: string[] = [`Quote v${item.quoteVersion}`];
  if (item.projectNumber) {
    parts.push(item.projectNumber);
  }
  if (item.requestNumber) {
    parts.push(item.requestNumber);
  }
  const text = parts.join(" · ");
  return text || "No linked request";
}

function responseHref(item: ClientQuoteResponseItem): string {
  // Prefer the concrete project page (PJ-...) when a project exists, so the
  // admin lands on the exact project instead of a generic list. Before a
  // project exists (PR-... only), the quote detail page is the review target.
  if (item.projectId) {
    const tab = item.action === "accepted" ? "overview" : "messages";
    return `/admin/projects/${item.projectId}?tab=${tab}`;
  }
  return `/admin/quotes/${item.quoteId}`;
}

function responseActionLabel(item: ClientQuoteResponseItem): string {
  if (item.projectId) {
    return item.action === "change_requested" ? "View Project & Reply" : "View Project";
  }
  return item.action === "change_requested" ? "Review Request" : "Review Quote";
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

  const items = responses.data;
  const openCount = items.filter(
    (item) => item.action === "change_requested" && item.open,
  ).length;

  return (
    <div className="space-y-4">
      {openCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            <span className="font-medium">
              {openCount} quote change request{openCount === 1 ? "" : "s"} awaiting review
            </span>{" "}
            — open the project or quote below, revise the quote, and reply to the client.
          </p>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-card-border bg-card">
        <div className="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.3fr)_8.5rem_auto] gap-4 border-b border-card-border px-6 py-3 text-xs font-medium tracking-[0.14em] text-muted uppercase sm:grid">
          <span>Client</span>
          <span>Response</span>
          <span>Quote / request</span>
          <span>Time</span>
          <span className="text-right">Action</span>
        </div>
        <ul className="divide-y divide-card-border">
          {items.map((item) => (
            <li
              key={item.id}
              className={`px-6 py-4 ${responseRowClass(item)}`}
            >
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.3fr)_8.5rem_auto] sm:items-start sm:gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {item.clientName ?? "Client"}
                  </p>
                  {item.requestNumber || item.projectNumber ? (
                    <p className="truncate text-xs text-muted">
                      {item.projectNumber ?? item.requestNumber}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${actionBadgeClass(item.action)}`}
                  >
                    {actionLabel(item.action)}
                  </span>
                  {item.action === "change_requested" && item.open ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                      Needs review
                    </span>
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">
                    {referenceCell(item)}
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
                <div className="sm:text-right">
                  <Link
                    href={responseHref(item)}
                    className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-card-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:border-foreground/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {responseActionLabel(item)}
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
