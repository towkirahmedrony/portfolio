import type { QuoteStatus } from "@/types/database";
import type { ProjectClient } from "@/lib/admin-project-constants";
import type { ProjectRow, QuoteItemRow, QuoteRow } from "@/types/database";

export const QUOTE_STATUSES: QuoteStatus[] = [
  "draft",
  "sent",
  "viewed",
  "accepted",
  "rejected",
  "expired",
  "cancelled",
];

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
  cancelled: "Cancelled",
};

export const QUOTE_STATUS_STYLES: Record<QuoteStatus, string> = {
  draft: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400",
  sent: "bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-400",
  viewed: "bg-purple-500/10 text-purple-700 border-purple-500/20 dark:text-purple-400",
  accepted: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400",
  rejected: "bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-400",
  expired: "bg-orange-500/10 text-orange-700 border-orange-500/20 dark:text-orange-400",
  cancelled: "bg-neutral-500/10 text-neutral-500 border-neutral-500/20",
};

export const QUOTE_STATUS_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ["sent", "cancelled"],
  sent: ["viewed", "accepted", "rejected", "expired", "cancelled"],
  viewed: ["accepted", "rejected", "expired", "cancelled"],
  accepted: [],
  rejected: [],
  expired: [],
  cancelled: [],
};

export type QuoteListFilters = {
  status?: string;
};

export type QuoteProjectSummary = Pick<
  ProjectRow,
  "id" | "project_number" | "title" | "client_id" | "currency"
>;

export type AdminQuoteListItem = QuoteRow & {
  project: QuoteProjectSummary | null;
  client: ProjectClient | null;
};

export type AdminQuoteDetail = {
  quote: QuoteRow;
  items: QuoteItemRow[];
  project: QuoteProjectSummary | null;
  client: ProjectClient | null;
  versions: QuoteRow[];
};

export type QuoteProjectOption = QuoteProjectSummary & {
  client: ProjectClient | null;
};

export function isQuoteStatus(value: string): value is QuoteStatus {
  return QUOTE_STATUSES.includes(value as QuoteStatus);
}

export function formatQuoteStatusLabel(status: string): string {
  if (isQuoteStatus(status)) {
    return QUOTE_STATUS_LABELS[status];
  }
  return status.replace(/_/g, " ");
}

export function getQuoteStatusStyle(status: string): string {
  return isQuoteStatus(status)
    ? QUOTE_STATUS_STYLES[status]
    : "border-card-border bg-background text-muted";
}

export function getAllowedQuoteTransitions(status: QuoteStatus): QuoteStatus[] {
  return QUOTE_STATUS_TRANSITIONS[status];
}

export function canEditQuote(status: QuoteStatus): boolean {
  return status === "draft";
}

export function canSendQuote(status: QuoteStatus): boolean {
  return status === "draft";
}

export function canCreateQuoteVersion(status: QuoteStatus): boolean {
  return status !== "cancelled";
}

export function buildQuotesHref(filters: QuoteListFilters): string {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }
  const query = params.toString();
  return query ? `/admin/quotes?${query}` : "/admin/quotes";
}

export function quoteDisplayId(quote: Pick<QuoteRow, "id" | "version">): string {
  return `${quote.id.slice(0, 8)} · v${quote.version}`;
}
