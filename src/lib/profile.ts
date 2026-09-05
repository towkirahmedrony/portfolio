import {
  REFERRAL_CLIENT_DISCOUNT_PERCENT,
  REFERRAL_REFERRER_REWARD_PERCENT,
} from "@/types/referral";
import { site } from "@/data/site";
import type {
  ProfileRow,
  ProfileUpdate,
  ReferralCodeRow,
  ReferralRewardRow,
  ReferralRow,
  ReferralStatus,
} from "@/types/database";
import type {
  CustomerAccount,
  CustomerProfile,
  CustomerProfileDraft,
  CustomerReferral,
  ReferralHistoryItem,
} from "@/types/profile";

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatLastActive(value: string | null): string {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function mapProfileRow(
  row: ProfileRow,
  email: string,
): { profile: CustomerProfile; account: CustomerAccount } {
  return {
    profile: {
      fullName: row.full_name,
      displayName: row.display_name ?? "",
      email,
      phone: row.phone ?? "",
      companyName: row.company_name ?? "",
      jobTitle: row.job_title ?? "",
      avatarUrl: row.avatar_url ?? "",
    },
    account: {
      role: row.role,
      status: row.status,
      emailVerified: row.email_verified,
      memberSince: formatDate(row.created_at),
      lastActive: formatLastActive(row.last_seen_at),
    },
  };
}

export function toProfileUpdate(draft: CustomerProfileDraft): ProfileUpdate {
  return {
    full_name: draft.fullName.trim(),
    display_name: emptyToNull(draft.displayName),
    phone: emptyToNull(draft.phone),
    company_name: emptyToNull(draft.companyName),
    job_title: emptyToNull(draft.jobTitle),
    avatar_url: emptyToNull(draft.avatarUrl),
  };
}

/**
 * Referral statuses (mirroring the DB enum) that count as qualified for the
 * customer view — i.e. everything past the initial "pending" stage that has
 * not been cancelled or rejected.
 */
const QUALIFIED_REFERRAL_STATUSES: ReferralStatus[] = [
  "qualified",
  "reward_pending",
  "reward_available",
  "completed",
];

/** Referral rows that should never count towards a customer's totals. */
const IGNORED_REFERRAL_STATUSES: ReferralStatus[] = ["cancelled", "invalid"];

function formatReferralDate(value: string | null): string {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export type CustomerReferralSource = {
  codes: Pick<ReferralCodeRow, "code" | "is_active">[] | null;
  referrals: Pick<
    ReferralRow,
    "id" | "status" | "referrer_reward_percent" | "created_at"
  >[] | null;
  availableRewards: Pick<
    ReferralRewardRow,
    "id" | "reward_percent" | "status" | "expires_at"
  >[] | null;
};

/**
 * Build the customer-facing referral view entirely from the authenticated
 * user's own database rows. No hardcoded counts, history, or rewards.
 */
export function buildCustomerReferral(
  source: CustomerReferralSource,
): CustomerReferral {
  const rows = source.referrals ?? [];
  const activeCode =
    source.codes?.find((row) => row.is_active) ??
    source.codes?.[0] ??
    null;
  const code = activeCode?.code.trim() ?? "";

  const counted = rows.filter(
    (row) => !IGNORED_REFERRAL_STATUSES.includes(row.status),
  );
  const qualified = rows.filter((row) =>
    QUALIFIED_REFERRAL_STATUSES.includes(row.status),
  );

  const now = Date.now();
  const usableRewards = (source.availableRewards ?? []).filter(
    (row) =>
      row.status === "available" &&
      (row.expires_at === null ||
        row.expires_at === undefined ||
        new Date(row.expires_at).getTime() > now),
  );
  const availableRewardPercent =
    usableRewards.length > 0
      ? Math.max(...usableRewards.map((row) => Number(row.reward_percent) || 0))
      : 0;

  const history: ReferralHistoryItem[] = rows.map((row) => ({
    id: row.id,
    // The referred client's identity is protected by RLS — clients can only
    // see the referral event itself, never another profile's details.
    referredName: null,
    status: row.status,
    rewardPercent: Number(row.referrer_reward_percent) || 0,
    date: formatReferralDate(row.created_at),
  }));

  return {
    code,
    codeActive: Boolean(activeCode?.is_active && code),
    link: code ? `${site.url}/start-project?ref=${code}` : "",
    totalReferrals: counted.length,
    qualifiedReferrals: qualified.length,
    availableRewardPercent,
    availableRewardStatus:
      availableRewardPercent > 0 ? "Available" : "Not available",
    terms: [
      `A referred client receives ${REFERRAL_CLIENT_DISCOUNT_PERCENT}% off their first project.`,
      `You receive a ${REFERRAL_REFERRER_REWARD_PERCENT}% reward on your next project after a referral qualifies.`,
      "Referral discounts do not stack with other offers.",
      "Rewards are applied to your next project once a referred client's first project qualifies.",
    ],
    history,
  };
}
