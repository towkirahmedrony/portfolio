import { formatMoney } from "@/lib/quote-money";
import type { ProjectClient, QueryResult } from "@/lib/admin-project-constants";
import type {
  ProjectRequestRow,
  ProjectRow,
  RequestStatus,
} from "@/types/database";

export { formatDate, formatDateTime } from "@/lib/admin-project-constants";
export type { QueryResult, ProjectClient };

export const REQUEST_STATUSES: RequestStatus[] = [
  "draft",
  "new",
  "reviewing",
  "quoted",
  "approved",
  "rejected",
  "converted",
  "cancelled",
];

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  draft: "Draft",
  new: "New",
  reviewing: "Reviewing",
  quoted: "Quoted",
  approved: "Approved",
  rejected: "Rejected",
  converted: "Converted",
  cancelled: "Cancelled",
};

export const CLIENT_REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  draft: "Draft",
  new: "New",
  reviewing: "Under Review",
  quoted: "Quote Ready",
  approved: "Approved",
  rejected: "Rejected",
  converted: "Project Started",
  cancelled: "Cancelled",
};

export const CLIENT_CANCELLABLE_REQUEST_STATUSES: RequestStatus[] = [
  "draft",
  "new",
  "reviewing",
  "quoted",
];

export function canClientCancelRequest(status: RequestStatus): boolean {
  return CLIENT_CANCELLABLE_REQUEST_STATUSES.includes(status);
}

export const REQUEST_STATUS_STYLES: Record<RequestStatus, string> = {
  draft: "bg-slate-500/10 text-slate-700 border-slate-500/20 dark:text-slate-400",
  new: "bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-400",
  reviewing: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400",
  quoted: "bg-purple-500/10 text-purple-700 border-purple-500/20 dark:text-purple-400",
  approved: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400",
  rejected: "bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-400",
  converted: "bg-teal-500/10 text-teal-700 border-teal-500/20 dark:text-teal-400",
  cancelled: "bg-neutral-500/10 text-neutral-500 border-neutral-500/20",
};

export const CONVERTIBLE_REQUEST_STATUS: RequestStatus = "approved";

export type ProjectRequestListFilters = {
  q?: string;
  status?: string;
  dir?: string;
};

export type LinkedProjectSummary = Pick<
  ProjectRow,
  "id" | "project_number" | "title" | "status"
>;

export type RequestReferralCode = {
  id: string;
  code: string;
  is_active: boolean;
};

export type AdminProjectRequestListItem = ProjectRequestRow;

export type AdminProjectRequestDetail = ProjectRequestRow & {
  client: ProjectClient | null;
  serviceName: string | null;
  referralCode: RequestReferralCode | null;
  linkedProject: LinkedProjectSummary | null;
};

export function isRequestStatus(value: string): value is RequestStatus {
  return REQUEST_STATUSES.includes(value as RequestStatus);
}

export function formatClientRequestStatusLabel(status: string): string {
  if (isRequestStatus(status)) {
    return CLIENT_REQUEST_STATUS_LABELS[status];
  }
  return status.replace(/_/g, " ");
}

export function formatRequestStatusLabel(status: string): string {
  if (isRequestStatus(status)) {
    return REQUEST_STATUS_LABELS[status];
  }
  return status.replace(/_/g, " ");
}

export function getRequestStatusStyle(status: string): string {
  return isRequestStatus(status)
    ? REQUEST_STATUS_STYLES[status]
    : "border-card-border bg-background text-muted";
}

export function formatRequestBudget(
  min: number | null,
  max: number | null,
  currency: string,
): string {
  const code = currency?.trim() || "BDT";
  if (min == null && max == null) {
    return "Not specified";
  }
  if (min != null && max != null) {
    return `${formatMoney(Number(min), code)} – ${formatMoney(Number(max), code)}`;
  }
  const amount = Number(min ?? max);
  if (min != null && max == null) {
    return `${formatMoney(amount, code)}+`;
  }
  return `Under ${formatMoney(amount, code)}`;
}

export function formatRequestDeadline(
  deadlineDate: string | null | undefined,
  deadlineType: string | null | undefined,
): string {
  if (deadlineDate) {
    const date = new Date(deadlineDate);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(date);
    }
    return deadlineDate;
  }
  if (deadlineType?.trim()) {
    return deadlineType.replace(/_/g, " ");
  }
  return "—";
}

export function formatYesNo(value: boolean | null | undefined): string {
  if (value === true) {
    return "Yes";
  }
  if (value === false) {
    return "No";
  }
  return "Not specified";
}

export function displaySlug(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/_/g, " ") : "—";
}

export function convertBlockedReason(
  status: RequestStatus,
  hasClient: boolean,
  alreadyConverted: boolean,
): string | null {
  if (alreadyConverted) {
    return "This request is already linked to a project.";
  }
  if (status === "converted") {
    return "This request is already marked converted.";
  }
  if (!hasClient) {
    return "This lead has no linked client profile, so it cannot be converted yet.";
  }
  if (status !== CONVERTIBLE_REQUEST_STATUS) {
    return "Only approved requests can be converted to a project.";
  }
  return null;
}

export function buildProjectRequestsHref(
  filters: ProjectRequestListFilters,
): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.dir && filters.dir !== "desc") params.set("dir", filters.dir);
  const query = params.toString();
  return query ? `/admin/project-requests?${query}` : "/admin/project-requests";
}
