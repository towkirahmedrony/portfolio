import type { ProfileStatus } from "@/types/database";
import type { QueryResult } from "@/lib/admin-project-constants";

export { formatDate, formatDateTime } from "@/lib/admin-project-constants";
export type { QueryResult };

export const CLIENT_PROFILE_STATUSES: ProfileStatus[] = [
  "active",
  "suspended",
  "deleted",
];

export const CLIENT_LIST_PAGE_SIZE = 25;

export const CLIENT_STATUS_LABELS: Record<ProfileStatus, string> = {
  active: "Active",
  suspended: "Suspended",
  deleted: "Deleted",
};

export const CLIENT_STATUS_STYLES: Record<ProfileStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400",
  suspended: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400",
  deleted: "bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-400",
};

export const EMAIL_VERIFIED_STYLES = {
  verified: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400",
  unverified: "bg-neutral-500/10 text-neutral-600 border-neutral-500/20 dark:text-neutral-400",
} as const;

/**
 * Sort fields map 1:1 to `profiles` columns. `email` is deliberately absent:
 * profiles do not store email (it lives in auth.users and is only exposed via
 * the admin_auth_emails RPC for display), so it cannot be sorted/filtered in
 * SQL alongside profiles columns.
 */
export const CLIENT_SORT_FIELDS = [
  "created_at",
  "updated_at",
  "last_seen_at",
  "full_name",
  "display_name",
  "company_name",
  "status",
] as const;

export type ClientSortField = (typeof CLIENT_SORT_FIELDS)[number];

export type ClientListFilters = {
  q?: string;
  status?: string;
  sort?: string;
  dir?: string;
  page?: string;
};

export type AdminClientListItem = {
  id: string;
  full_name: string;
  display_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  company_name: string | null;
  job_title: string | null;
  role: "client";
  status: ProfileStatus;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
  last_seen_at: string | null;
  /** Populated from auth.users via the admin_auth_emails RPC when available. */
  email: string | null;
};

export type AdminClientListData = {
  items: AdminClientListItem[];
  emailsAvailable: boolean;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type AdminClientDetail = AdminClientListItem;

export function isClientStatus(value: string): value is ProfileStatus {
  return CLIENT_PROFILE_STATUSES.includes(value as ProfileStatus);
}

export function isClientSortField(value: string): value is ClientSortField {
  return CLIENT_SORT_FIELDS.includes(value as ClientSortField);
}

export function formatClientStatusLabel(status: string): string {
  if (isClientStatus(status)) {
    return CLIENT_STATUS_LABELS[status];
  }
  return status.replace(/_/g, " ");
}

export function getClientStatusStyle(status: string): string {
  if (isClientStatus(status)) {
    return CLIENT_STATUS_STYLES[status];
  }
  return "border-card-border bg-background text-muted";
}

export function buildClientsHref(filters: ClientListFilters): string {
  const params = new URLSearchParams();
  const { q, status, sort, dir, page } = filters;

  if (q) params.set("q", q);
  if (status && status !== "all") params.set("status", status);
  if (sort && sort !== "created_at") params.set("sort", sort);
  if (dir && dir !== "desc") params.set("dir", dir);
  if (page && page !== "1") params.set("page", page);

  const query = params.toString();
  return query ? `/admin/clients?${query}` : "/admin/clients";
}
