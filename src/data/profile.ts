import {
  REFERRAL_CLIENT_DISCOUNT_PERCENT,
  REFERRAL_REFERRER_REWARD_PERCENT,
} from "@/types/referral";
import type { CustomerReferral } from "@/types/profile";
import { site } from "@/data/site";

const referralCode = "MAYA2025";

export const mockCustomerReferral: CustomerReferral = {
  code: referralCode,
  link: `${site.url}/start-project?ref=${referralCode}`,
  totalReferrals: 6,
  qualifiedReferrals: 3,
  availableRewardPercent: REFERRAL_REFERRER_REWARD_PERCENT,
  availableRewardStatus: "Available",
  terms: [
    `A referred client receives ${REFERRAL_CLIENT_DISCOUNT_PERCENT}% off their first project.`,
    `You receive a ${REFERRAL_REFERRER_REWARD_PERCENT}% reward on your next project after a referral qualifies.`,
    "Referral discounts do not stack with other offers.",
    "Reward availability and qualification will be confirmed from your account data later.",
  ],
  history: [
    {
      id: "rw-01",
      referredName: "Nadia Hasan",
      status: "Reward available",
      rewardPercent: REFERRAL_REFERRER_REWARD_PERCENT,
      date: "18 Aug 2025",
    },
    {
      id: "rw-02",
      referredName: "Omar Chowdhury",
      status: "Qualified",
      rewardPercent: REFERRAL_REFERRER_REWARD_PERCENT,
      date: "2 Jul 2025",
    },
    {
      id: "rw-03",
      referredName: "Lina Ahmed",
      status: "Pending",
      rewardPercent: REFERRAL_REFERRER_REWARD_PERCENT,
      date: "21 Jun 2025",
    },
    {
      id: "rw-04",
      referredName: "Farhan Islam",
      status: "Redeemed",
      rewardPercent: REFERRAL_REFERRER_REWARD_PERCENT,
      date: "9 May 2025",
    },
  ],
};
