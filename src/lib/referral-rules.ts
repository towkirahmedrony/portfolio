/**
 * Referral admin rules — validation bounds for the settings form.
 *
 * Customer-facing referral views and all reward/discount computation are driven
 * exclusively by the database (referral_settings plus the snapshots stored on
 * public.referrals); they never read the defaults below. These values only seed
 * the admin settings form when no referral_settings row exists yet, and mirror
 * the column defaults in the database.
 */
export const REFERRAL_DEFAULT_CLIENT_DISCOUNT_PERCENT = 5;
export const REFERRAL_DEFAULT_REFERRER_REWARD_PERCENT = 2;

export const REFERRAL_PERCENT_MIN = 0;
export const REFERRAL_PERCENT_MAX = 100;
export const REFERRAL_VALIDITY_DAYS_MIN = 1;
export const REFERRAL_VALIDITY_DAYS_MAX = 3650;

export type ReferralProgramSettings = {
  newClientDiscountPercent: number;
  referrerRewardPercent: number;
  minimumProjectAmount: number | null;
  rewardValidityDays: number | null;
  isActive: boolean;
};

export const REFERRAL_DEFAULT_SETTINGS: ReferralProgramSettings = {
  newClientDiscountPercent: REFERRAL_DEFAULT_CLIENT_DISCOUNT_PERCENT,
  referrerRewardPercent: REFERRAL_DEFAULT_REFERRER_REWARD_PERCENT,
  minimumProjectAmount: null,
  rewardValidityDays: null,
  isActive: true,
};

export function isValidReferralPercent(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value >= REFERRAL_PERCENT_MIN &&
    value <= REFERRAL_PERCENT_MAX
  );
}

export function isValidMinimumProjectAmount(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function isValidRewardValidityDays(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= REFERRAL_VALIDITY_DAYS_MIN &&
    value <= REFERRAL_VALIDITY_DAYS_MAX
  );
}

/** Map a DB settings row onto the effective program settings (defaults win on null). */
export function toReferralProgramSettings(
  row: {
    new_client_discount_percent: number;
    referrer_reward_percent: number;
    minimum_project_amount: number | null;
    reward_validity_days: number | null;
    is_active: boolean;
  } | null,
): ReferralProgramSettings {
  if (!row) {
    return { ...REFERRAL_DEFAULT_SETTINGS };
  }
  return {
    newClientDiscountPercent: row.new_client_discount_percent,
    referrerRewardPercent: row.referrer_reward_percent,
    minimumProjectAmount: row.minimum_project_amount,
    rewardValidityDays: row.reward_validity_days,
    isActive: row.is_active,
  };
}
