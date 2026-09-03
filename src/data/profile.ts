import {
  REFERRAL_CLIENT_DISCOUNT_PERCENT,
  REFERRAL_REFERRER_REWARD_PERCENT,
} from "@/types/referral";
import type { CustomerReferral } from "@/types/profile";

export const mockCustomerReferral: CustomerReferral = {
  code: "",
  link: "",
  totalReferrals: 0,
  qualifiedReferrals: 0,
  availableRewardPercent: 0,
  availableRewardStatus: "Not available",
  terms: [
    `A referred client receives ${REFERRAL_CLIENT_DISCOUNT_PERCENT}% off their first project.`,
    `You receive a ${REFERRAL_REFERRER_REWARD_PERCENT}% reward on your next project after a referral qualifies.`,
    "Referral discounts do not stack with other offers.",
    "Reward availability and qualification will be confirmed from your account data later.",
  ],
  history: [],
};
