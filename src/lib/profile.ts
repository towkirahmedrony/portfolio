import { buildReferralLink } from "@/lib/referral-code";
import type {
  ProfileRow,
  ProfileUpdate,
  ReferralCodeRow,
  ReferralRewardRow,
  ReferralRow,
  ReferralSettingsRow,
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
    | "id"
    | "status"
    | "referrer_reward_percent"
    | "client_discount_percent"
    | "created_at"
    | "project_request_id"
    | "first_project_id"
  >[] | null;
  rewards: Pick<
    ReferralRewardRow,
    "id" | "referral_id" | "reward_percent" | "status" | "expires_at"
  >[] | null;
  /** Latest referral_settings row. Percentages are never hardcoded here. */
  settings: Pick<
    ReferralSettingsRow,
    | "new_client_discount_percent"
    | "referrer_reward_percent"
    | "minimum_project_amount"
    | "reward_validity_days"
    | "is_active"
  > | null;
  /** The signed-in customer's own relationship when they were referred. */
  referred: Pick<
    ReferralRow,
    | "status"
    | "client_discount_percent"
    | "referrer_reward_percent"
    | "created_at"
    | "project_request_id"
    | "first_project_id"
  > | null;
};

/** Trim trailing zeros so 5.00 renders as "5" and 12.50 as "12.5". */
export function formatReferralPercent(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return `${Number(value.toFixed(2))}`;
}

function isRewardUsable(expiresAt: string | null, now: number): boolean {
  if (expiresAt === null || expiresAt === undefined) {
    return true;
  }
  return new Date(expiresAt).getTime() > now;
}

/**
 * Build the customer-facing referral view entirely from the authenticated
 * user's own database rows and the live referral_settings row. No hardcoded
 * counts, history, percentages, minimums, or validity windows.
 */
export function buildCustomerReferral(
  source: CustomerReferralSource,
): CustomerReferral {
  const rows = source.referrals ?? [];
  const settings = source.settings;

  const programActive = Boolean(settings?.is_active);
  const clientDiscountPercent = settings
    ? Number(settings.new_client_discount_percent) || 0
    : 0;
  const referrerRewardPercent = settings
    ? Number(settings.referrer_reward_percent) || 0
    : 0;
  const minimumProjectAmount = settings?.minimum_project_amount ?? null;
  const rewardValidityDays = settings?.reward_validity_days ?? null;

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
  const usableRewards = (source.rewards ?? []).filter(
    (row) =>
      row.status === "available" && isRewardUsable(row.expires_at, now),
  );
  const availableRewardPercent =
    usableRewards.length > 0
      ? Math.max(...usableRewards.map((row) => Number(row.reward_percent) || 0))
      : 0;
  const totalEarnedRewardPercent = usableRewards.reduce(
    (sum, row) => sum + (Number(row.reward_percent) || 0),
    0,
  );

  const rewardsByReferral = new Map<string, ReferralRewardRow["status"]>();
  for (const reward of usableRewards) {
    rewardsByReferral.set(reward.referral_id, reward.status);
  }

  const history: ReferralHistoryItem[] = rows.map((row) => {
    const rewardExpiry =
      (source.rewards ?? []).find((reward) => reward.referral_id === row.id)
        ?.expires_at ?? null;

    return {
      id: row.id,
      // The referred client's identity is protected by RLS — clients can only
      // see the referral event itself, never another profile's details.
      referredName: null,
      status: row.status,
      rewardPercent: Number(row.referrer_reward_percent) || 0,
      clientDiscountPercent: Number(row.client_discount_percent) || 0,
      firstProjectLinked: row.first_project_id !== null,
      rewardStatus: rewardsByReferral.get(row.id) ?? null,
      rewardExpiresAt: rewardExpiry,
      date: formatReferralDate(row.created_at),
    };
  });

  const terms: string[] = [];
  if (!settings) {
    terms.push(
      "Referral terms are not configured yet, so no new referral rewards can be earned.",
    );
  } else {
    terms.push(
      `A referred client receives ${formatReferralPercent(clientDiscountPercent)}% off their first project.`,
    );
    terms.push(
      `You earn a ${formatReferralPercent(referrerRewardPercent)}% reward once a referred client's first project completes.`,
    );
    if (minimumProjectAmount !== null && Number(minimumProjectAmount) > 0) {
      terms.push(
        `A referral only qualifies once that first project reaches ${Number(minimumProjectAmount)}.`,
      );
    }
    terms.push(
      rewardValidityDays !== null && rewardValidityDays > 0
        ? `Rewards stay available for ${rewardValidityDays} days from the day they are earned.`
        : "Rewards do not expire.",
    );
    terms.push(
      "The discount applies only to the referred client's first project, and referral terms are fixed at sign-up time.",
    );
    if (!programActive) {
      terms.push(
        "The referral programme is currently paused, so new referrals are not being created.",
      );
    }
  }

  const referred = source.referred
    ? {
        status: source.referred.status,
        clientDiscountPercent:
          Number(source.referred.client_discount_percent) || 0,
        referrerRewardPercent:
          Number(source.referred.referrer_reward_percent) || 0,
        requestLinked: source.referred.project_request_id !== null,
        firstProjectLinked: source.referred.first_project_id !== null,
        rewardAvailable: QUALIFIED_REFERRAL_STATUSES.includes(
          source.referred.status,
        ),
        date: formatReferralDate(source.referred.created_at),
      }
    : null;

  return {
    code,
    codeActive: Boolean(activeCode?.is_active && code),
    link: code ? buildReferralLink(code) : "",
    totalReferrals: counted.length,
    qualifiedReferrals: qualified.length,
    programActive,
    clientDiscountPercent,
    referrerRewardPercent,
    minimumProjectAmount:
      minimumProjectAmount === null ? null : Number(minimumProjectAmount),
    rewardValidityDays,
    availableRewardPercent,
    availableRewardStatus:
      availableRewardPercent > 0 ? "Available" : "Not available",
    totalEarnedRewardPercent,
    terms,
    history,
    referredBy: referred,
  };
}
