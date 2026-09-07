import type {
  InvoiceRow,
  ProjectRequestRow,
  QuoteStatus,
  RequestStatus,
} from "@/types/database";
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

export const CLIENT_QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Draft",
  sent: "Awaiting Your Approval",
  viewed: "Awaiting Your Approval",
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

/**
 * Quotes attach to an existing project only. A request is quotable after it
 * has been explicitly converted (project_requests.status = converted) and a
 * projects row already exists. Creating or updating a quote never converts a
 * request or creates a project.
 */
export const QUOTABLE_REQUEST_STATUSES: RequestStatus[] = ["converted"];

export type QuoteRequestLink = Pick<
  ProjectRequestRow,
  "id" | "request_number" | "project_type"
>;

export type QuoteInvoiceLink = Pick<InvoiceRow, "id" | "invoice_number" | "status">;

export type QuoteProjectSummary = Pick<
  ProjectRow,
  "id" | "project_number" | "title" | "client_id" | "currency" | "request_id"
>;

export type AdminQuoteListItem = QuoteRow & {
  project: QuoteProjectSummary | null;
  request: QuoteRequestLink | null;
  client: ProjectClient | null;
  invoice: QuoteInvoiceLink | null;
};

export type AdminQuoteDetail = {
  quote: QuoteRow;
  items: QuoteItemRow[];
  project: QuoteProjectSummary | null;
  client: ProjectClient | null;
  versions: QuoteRow[];
  invoice: QuoteInvoiceLink | null;
};

export type QuoteProjectOption = QuoteProjectSummary & {
  client: ProjectClient | null;
};

export type QuoteEligibleRequestListItem = {
  id: string;
  request_number: string;
  client_id: string;
  full_name: string;
  email: string;
  company_name: string | null;
  project_type: string | null;
  service_id: string | null;
  status: RequestStatus;
  budget_min: number | null;
  budget_max: number | null;
  budget_currency: string | null;
  deadline_type: string | null;
  deadline_date: string | null;
  submitted_at: string;
  client: ProjectClient | null;
};

export function quoteFromRequestBlockedReason(
  _status: RequestStatus,
  _hasClient: boolean,
  alreadyConverted: boolean,
): string | null {
  if (alreadyConverted) {
    return null;
  }
  return "Convert this request to a project first. Creating or updating a quote never creates a project.";
}

export function resolveExistingProjectForQuote(
  linkedProjectId: string | null | undefined,
): { ok: true; projectId: string } | { ok: false; error: string } {
  if (!linkedProjectId) {
    return {
      ok: false,
      error:
        "Convert this request to a project first. Quotes can only be created on an existing project.",
    };
  }
  return { ok: true, projectId: linkedProjectId };
}

export function isQuoteStatus(value: string): value is QuoteStatus {
  return QUOTE_STATUSES.includes(value as QuoteStatus);
}

export function formatQuoteStatusLabel(status: string): string {
  if (isQuoteStatus(status)) {
    return QUOTE_STATUS_LABELS[status];
  }
  return status.replace(/_/g, " ");
}

export function formatClientQuoteStatusLabel(status: string): string {
  if (isQuoteStatus(status)) {
    return CLIENT_QUOTE_STATUS_LABELS[status];
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

export function canClientAcceptQuote(status: QuoteStatus, validUntil?: string | null): boolean {
  if (status !== "sent" && status !== "viewed") {
    return false;
  }
  if (validUntil) {
    const expires = new Date(validUntil);
    if (!Number.isNaN(expires.getTime()) && expires.getTime() < Date.now()) {
      return false;
    }
  }
  return true;
}

export function canClientRejectQuote(status: QuoteStatus): boolean {
  return status === "sent" || status === "viewed";
}

export function canClientRequestQuoteChanges(status: QuoteStatus): boolean {
  return status === "sent" || status === "viewed" || status === "rejected" || status === "expired";
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
