export const REFERRAL_CLIENT_DISCOUNT_PERCENT = 5;
export const REFERRAL_REFERRER_REWARD_PERCENT = 2;

export type ReferralVerificationStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "invalid"
  | "self_referral";

export type ReferralRewardStatus =
  | "pending"
  | "earned"
  | "applied"
  | "expired";

export type ProjectReferralPayload = {
  referralCode: string | null;
  referredBy: string | null;
  referralStatus: ReferralVerificationStatus;
  referredProject: "first";
  clientDiscountPercent: typeof REFERRAL_CLIENT_DISCOUNT_PERCENT;
  referrerRewardPercent: typeof REFERRAL_REFERRER_REWARD_PERCENT;
  rewardStatus: ReferralRewardStatus;
  rewardUsed: boolean;
  rewardExpiresAt: string | null;
  discountsStackable: false;
};
