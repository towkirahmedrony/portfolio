"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import {
  isValidMinimumProjectAmount,
  isValidReferralPercent,
  isValidRewardValidityDays,
} from "@/lib/referral-rules";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { ok: false; error: string };

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalNumber(value: FormDataEntryValue | null): number | null {
  const raw = asString(value);
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Save referral program settings. Validation is performed here against the
 * centralized referral rules and enforced again inside the DB RPC, which is
 * admin-gated (is_active_admin). Reward state is never touched by this action.
 */
export async function updateReferralSettings(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const clientDiscount = asOptionalNumber(formData.get("clientDiscountPercent"));
  const referrerReward = asOptionalNumber(formData.get("referrerRewardPercent"));
  const minimumAmount = asOptionalNumber(formData.get("minimumProjectAmount"));
  const validityDays = asOptionalNumber(formData.get("rewardValidityDays"));
  const isActiveRaw = asString(formData.get("isActive"));
  const isActive = isActiveRaw !== "false";

  if (clientDiscount == null || !isValidReferralPercent(clientDiscount)) {
    return { ok: false, error: "New client discount must be between 0 and 100." };
  }
  if (referrerReward == null || !isValidReferralPercent(referrerReward)) {
    return { ok: false, error: "Referrer reward must be between 0 and 100." };
  }
  if (
    minimumAmount != null &&
    !isValidMinimumProjectAmount(minimumAmount)
  ) {
    return { ok: false, error: "Minimum project amount cannot be negative." };
  }
  if (validityDays != null && !isValidRewardValidityDays(validityDays)) {
    return {
      ok: false,
      error: "Reward validity must be a whole number of days between 1 and 3650.",
    };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("admin_update_referral_settings", {
    p_client_discount_percent: clientDiscount,
    p_referrer_reward_percent: referrerReward,
    p_minimum_project_amount: minimumAmount,
    p_reward_validity_days: validityDays,
    p_is_active: isActive,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/referrals");
  revalidatePath("/admin/referrals/settings");
  return { ok: true };
}
