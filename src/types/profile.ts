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
  rewardPercent: number;
  date: string;
};

export type CustomerReferral = {
  code: string;
  /** Whether the current referral code is active and can be shared. */
  codeActive: boolean;
  link: string;
  totalReferrals: number;
  qualifiedReferrals: number;
  availableRewardPercent: number;
  availableRewardStatus: string;
  terms: string[];
  history: ReferralHistoryItem[];
};
