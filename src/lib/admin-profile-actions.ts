"use server";

import { revalidatePath } from "next/cache";
import { isValidHttpUrl } from "@/lib/admin-content-constants";
import { removeStorageObject } from "@/lib/photo-storage";
import { requireAdmin } from "@/lib/require-admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveAdminAvatar(
  avatarUrl: string | null,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (avatarUrl && !isValidHttpUrl(avatarUrl)) {
    return { ok: false, error: "Avatar must be a valid http(s) URL." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: existing, error: lookupError } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", admin.id)
    .maybeSingle();
  if (lookupError) {
    return { ok: false, error: lookupError.message };
  }

  const previous = (existing as { avatar_url: string | null } | null)?.avatar_url ?? null;
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", admin.id);
  if (error) {
    return { ok: false, error: error.message };
  }

  if (previous && previous !== avatarUrl) {
    await removeStorageObject(previous);
  }

  revalidatePath("/admin/profile");
  return { ok: true };
}
