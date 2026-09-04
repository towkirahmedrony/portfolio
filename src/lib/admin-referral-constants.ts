import type { QueryResult } from "@/lib/admin-project-constants";
import type {
  ProfileRow,
  ReferralRewardRow,
  ReferralStatus,
  RewardStatus,
} from "@/types/database";

export { formatDate, formatDateTime } from "@/lib/admin-project-constants";
export type { QueryResult };

export const REFERRAL_STATUSES: ReferralStatus[] = [
  "pending",
  "qualified",
  "reward_pending",
  "reward_available",
  "completed",
  "cancelled",
  "invalid",
];

export const REFERRAL_REWARD_STATUSES: RewardStatus[] = [
  "pending",
  "available",
  "redeemed",
  "expired",
  "cancelled",
];

/** Referral statuses that count as qualified (past the pending stage). */
export const QUALIFIED_REFERRAL_STATUSES: ReferralStatus[] = [
  "qualified",
  "reward_pending",
  "reward_available",
  "completed",
];

export const REFERRAL_STATUS_LABELS: Record<ReferralStatus, string> = {
  pending: "Pending",
  qualified: "Qualified",
  reward_pending: "Reward pending",
  reward_available: "Reward available",
  completed: "Completed",
  cancelled: "Cancelled",
  invalid: "Invalid",
};

export const REFERRAL_STATUS_STYLES: Record<ReferralStatus, string> = {
  pending: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400",
  qualified: "bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-400",
  reward_pending: "bg-purple-500/10 text-purple-700 border-purple-500/20 dark:text-purple-400",
  reward_available: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400",
  completed: "bg-teal-500/10 text-teal-700 border-teal-500/20 dark:text-teal-400",
  cancelled: "bg-neutral-500/10 text-neutral-500 border-neutral-500/20",
  invalid: "bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-400",
};

export const REWARD_STATUS_LABELS: Record<RewardStatus, string> = {
  pending: "Pending",
  available: "Available",
  redeemed: "Redeemed",
  expired: "Expired",
  cancelled: "Cancelled",
};

export const REWARD_STATUS_STYLES: Record<RewardStatus, string> = {
  pending: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400",
  available: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400",
  redeemed: "bg-teal-500/10 text-teal-700 border-teal-500/20 dark:text-teal-400",
  expired: "bg-neutral-500/10 text-neutral-500 border-neutral-500/20",
  cancelled: "bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-400",
};

export const REFERRAL_SORT_FIELDS = [
  "created_at",
  "qualified_at",
  "completed_at",
  "status",
  "client_discount_percent",
  "referrer_reward_percent",
] as const;

export type ReferralSortField = (typeof REFERRAL_SORT_FIELDS)[number];

export const REFERRAL_LIST_PAGE_SIZE = 25;

export type ReferralListFilters = {
  q?: string;
  status?: string;
  sort?: string;
  dir?: string;
  page?: string;
};

export type ReferralPersonRef = Pick<
  ProfileRow,
  "id" | "full_name" | "display_name" | "company_name" | "avatar_url"
>;

export type AdminReferralListItem = {
  id: string;
  referrer_id: string;
  referred_client_id: string | null;
  referral_code_id: string;
  project_request_id: string | null;
  first_project_id: string | null;
  status: ReferralStatus;
  client_discount_percent: number;
  referrer_reward_percent: number;
  created_at: string;
  qualified_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  referrer: ReferralPersonRef | null;
  referredClient: ReferralPersonRef | null;
  code: string | null;
  requestNumber: string | null;
  projectNumber: string | null;
  projectTitle: string | null;
};

export type ReferralOverviewResult = {
  codes: QueryResult<{ total: number; active: number }>;
  referrals: QueryResult<{ total: number; qualified: number }>;
  rewards: QueryResult<{
    pending: number;
    available: number;
    redeemed: number;
  }>;
};

export type AdminReferralRewardItem = ReferralRewardRow & {
  redeemedProjectNumber: string | null;
};

export type AdminReferralDetail = AdminReferralListItem & {
  rewards: QueryResult<AdminReferralRewardItem[]>;
};

export function isReferralStatus(value: string): value is ReferralStatus {
  return REFERRAL_STATUSES.includes(value as ReferralStatus);
}

export function isReferralSortField(value: string): value is ReferralSortField {
  return REFERRAL_SORT_FIELDS.includes(value as ReferralSortField);
}

export function formatReferralStatusLabel(status: string): string {
  if (isReferralStatus(status)) {
    return REFERRAL_STATUS_LABELS[status];
  }
  return status.replace(/_/g, " ");
}

export function getReferralStatusStyle(status: string): string {
  if (isReferralStatus(status)) {
    return REFERRAL_STATUS_STYLES[status];
  }
  return "border-card-border bg-background text-muted";
}

export function formatRewardStatusLabel(status: string): string {
  if (REFERRAL_REWARD_STATUSES.includes(status as RewardStatus)) {
    return REWARD_STATUS_LABELS[status as RewardStatus];
  }
  return status.replace(/_/g, " ");
}

export function getRewardStatusStyle(status: string): string {
  if (REFERRAL_REWARD_STATUSES.includes(status as RewardStatus)) {
    return REWARD_STATUS_STYLES[status as RewardStatus];
  }
  return "border-card-border bg-background text-muted";
}

export function formatPercentLabel(value: number | null | undefined): string {
  if (value == null) {
    return "—";
  }
  return `${value}%`;
}

export function personDisplayName(person: ReferralPersonRef | null): string {
  if (!person) {
    return "Unknown";
  }
  return person.display_name?.trim() || person.full_name.trim() || "Unknown";
}

export function buildReferralsHref(filters: ReferralListFilters): string {
  const params = new URLSearchParams();
  const { q, status, sort, dir, page } = filters;

  if (q) params.set("q", q);
  if (status && status !== "all") params.set("status", status);
  if (sort && sort !== "created_at") params.set("sort", sort);
  if (dir && dir !== "desc") params.set("dir", dir);
  if (page && page !== "1") params.set("page", page);

  const query = params.toString();
  return query ? `/admin/referrals?${query}` : "/admin/referrals";
}
