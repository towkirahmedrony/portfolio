import type { QueryResult } from "@/lib/admin-project-constants";
import type { ReviewRow, ReviewStatus } from "@/types/database";

export { formatDate, formatDateTime } from "@/lib/admin-project-constants";
export type { QueryResult };
export type { ReviewRow, ReviewStatus };

export const REVIEW_STATUSES: ReviewStatus[] = [
  "pending",
  "approved",
  "rejected",
  "hidden",
];

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  hidden: "Hidden",
};

export const REVIEW_STATUS_STYLES: Record<ReviewStatus, string> = {
  pending: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400",
  approved: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400",
  rejected: "bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-400",
  hidden: "bg-neutral-500/10 text-neutral-600 border-neutral-500/20 dark:text-neutral-400",
};

/**
 * Moderation actions. The state machine is centralized here so the admin UI
 * and the server action share one definition of what is allowed.
 */
export type ReviewModerationAction =
  | "approve"
  | "publish"
  | "reject"
  | "hide"
  | "unhide";

export const REVIEW_ACTION_LABELS: Record<ReviewModerationAction, string> = {
  approve: "Approve",
  publish: "Publish",
  reject: "Reject",
  hide: "Hide",
  unhide: "Unhide",
};

export type ModerationOutcome =
  | { ok: true; updates: Pick<ReviewRow, "status" | "published_at"> }
  | { ok: false; reason: string };

/**
 * Which actions are allowed for a review row. publish is only offered for
 * approved reviews that have not been published yet.
 */
export function allowedModerationActions(
  status: ReviewStatus,
  publishedAt: string | null,
): ReviewModerationAction[] {
  switch (status) {
    case "pending":
      return ["approve", "reject"];
    case "approved":
      return [
        ...(publishedAt ? [] : (["publish"] as ReviewModerationAction[])),
        "reject",
        "hide",
      ];
    case "hidden":
      return ["unhide", "reject"];
    case "rejected":
      return [];
    default:
      return [];
  }
}

/** Applies an action to a review's moderation state (status/published_at only). */
export function applyModerationAction(
  review: Pick<ReviewRow, "status" | "published_at">,
  action: ReviewModerationAction,
): ModerationOutcome {
  const { status, published_at } = review;
  const allowed = allowedModerationActions(status, published_at);

  if (!allowed.includes(action)) {
    return {
      ok: false,
      reason: `"${REVIEW_ACTION_LABELS[action]}" is not allowed while the review is ${REVIEW_STATUS_LABELS[status].toLowerCase()}.`,
    };
  }

  switch (action) {
    case "approve":
      return { ok: true, updates: { status: "approved", published_at: null } };
    case "publish":
      return {
        ok: true,
        updates: { status: "approved", published_at: new Date().toISOString() },
      };
    case "reject":
      return { ok: true, updates: { status: "rejected", published_at: null } };
    case "hide":
      return { ok: true, updates: { status: "hidden", published_at: null } };
    case "unhide":
      return { ok: true, updates: { status: "approved", published_at: null } };
    default:
      return { ok: false, reason: "Unknown action." };
  }
}

export function formatReviewStatusLabel(status: string): string {
  if (REVIEW_STATUSES.includes(status as ReviewStatus)) {
    return REVIEW_STATUS_LABELS[status as ReviewStatus];
  }
  return status.replace(/_/g, " ");
}

export function getReviewStatusStyle(status: string): string {
  if (REVIEW_STATUSES.includes(status as ReviewStatus)) {
    return REVIEW_STATUS_STYLES[status as ReviewStatus];
  }
  return "border-card-border bg-background text-muted";
}

export function isReviewStatus(value: string): value is ReviewStatus {
  return REVIEW_STATUSES.includes(value as ReviewStatus);
}

export function isReviewModerationAction(value: string): value is ReviewModerationAction {
  return (
    value === "approve" ||
    value === "publish" ||
    value === "reject" ||
    value === "hide" ||
    value === "unhide"
  );
}

export type ReviewFilters = { status?: string };

export type AdminReviewItem = {
  id: string;
  project_id: string;
  client_id: string;
  rating: number;
  title: string | null;
  review: string;
  status: ReviewStatus;
  submitted_at: string;
  published_at: string | null;
  clientName: string;
  clientCompany: string | null;
  projectNumber: string;
  projectTitle: string;
};

export function buildReviewsHref(filters: ReviewFilters): string {
  if (filters.status && filters.status !== "all") {
    return `/admin/reviews?status=${filters.status}`;
  }
  return "/admin/reviews";
}
