"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { NOTIFICATION_TOGGLES } from "@/lib/notification-preference-definitions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { NotificationPreferenceRow } from "@/types/database";

type ActionResult = { ok: true } | { ok: false; error: string };

function asCheckbox(value: FormDataEntryValue | null): boolean {
  return value === "on";
}

/**
 * Save the current admin's own notification preferences. Upsert is scoped by
 * RLS to auth.uid() — an admin can never touch another user's row.
 */
export async function saveNotificationPreferences(
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireAdmin();

  const payload: Partial<NotificationPreferenceRow> = {
    user_id: session.id,
    updated_at: new Date().toISOString(),
  };
  for (const toggle of NOTIFICATION_TOGGLES) {
    payload[toggle.key] = asCheckbox(formData.get(toggle.key));
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("notification_preferences")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/settings");
  return { ok: true };
}
