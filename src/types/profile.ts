import type { ProfileRole, ProfileStatus } from "@/types/database";

export type { ProfileRole, ProfileStatus };

export type CustomerProfile = {
  fullName: string;
  displayName: string;
  email: string;
  phone: string;
  companyName: string;
  jobTitle: string;
  avatarUrl: string;
};

export type CustomerProfileDraft = Omit<CustomerProfile, "email">;

export type CustomerProfileErrors = Partial<
  Record<keyof CustomerProfileDraft, string>
>;

export type CustomerAccount = {
  role: ProfileRole;
  status: ProfileStatus;
  emailVerified: boolean;
  memberSince: string;
  lastActive: string;
};

export type ReferralHistoryItem = {
  id: string;
  /** Referred client display name. Only populated when the database exposes it. */
  referredName: string | null;
  status: string;
  /** Stored snapshot for this referral, not the current global setting. */
  rewardPercent: number;
  /** Stored snapshot of the discount the referred client was given. */
  clientDiscountPercent: number;
  /** Whether the referred client's first project is already linked. */
  firstProjectLinked: boolean;
  rewardStatus: string | null;
  rewardExpiresAt: string | null;
  date: string;
};

/** The referral relationship seen from the referred customer's own side. */
export type ReferredCustomerReferral = {
  status: string;
  /** Stored snapshot of this customer's first-project discount. */
  clientDiscountPercent: number;
  /** Share the referrer is promised once this customer's first project qualifies. */
  referrerRewardPercent: number;
  requestLinked: boolean;
  firstProjectLinked: boolean;
  rewardAvailable: boolean;
  date: string;
};

export type CustomerReferral = {
  code: string;
  /** Whether the current referral code is active and can be shared. */
  codeActive: boolean;
  link: string;
  totalReferrals: number;
  qualifiedReferrals: number;
  /** Live program settings, read from referral_settings (never hardcoded). */
  programActive: boolean;
  clientDiscountPercent: number;
  referrerRewardPercent: number;
  minimumProjectAmount: number | null;
  rewardValidityDays: number | null;
  availableRewardPercent: number;
  availableRewardStatus: string;
  /** Total reward percent the customer has earned and not yet consumed. */
  totalEarnedRewardPercent: number;
  terms: string[];
  history: ReferralHistoryItem[];
  /** Set when the signed-in customer was themselves referred by someone else. */
  referredBy: ReferredCustomerReferral | null;
};
