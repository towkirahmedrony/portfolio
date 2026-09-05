"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { isValidHttpUrl } from "@/lib/admin-content-constants";
import { removeStorageObject } from "@/lib/photo-storage";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { ok: false; error: string };

const MANAGEABLE_CLIENT_STATUSES = ["active", "suspended"] as const;

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function revalidateClient(clientId: string) {
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${clientId}`);
}

/**
 * Activate or suspend a client account. The actual write runs through the
 * admin_set_client_status RPC (security definer, re-checks is_active_admin,
 * only touches rows where role = 'client') so protected fields such as id and
 * role can never be changed and Supabase Auth is never touched from here.
 */
export async function setClientStatus(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const clientId = asString(formData.get("clientId"));
  const statusRaw = asString(formData.get("status"));

  if (!clientId) {
    return { ok: false, error: "Missing client." };
  }
  if (!(MANAGEABLE_CLIENT_STATUSES as readonly string[]).includes(statusRaw)) {
    return { ok: false, error: "Invalid account status." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("admin_set_client_status", {
    p_client_id: clientId,
    p_status: statusRaw,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateClient(clientId);
  return { ok: true };
}

/**
 * Manual email verification override (admin support flows only). Runs through
 * the admin_set_client_email_verified RPC — never through Supabase Auth from
 * client-side code. profiles.email_verified is otherwise derived from auth and
 * re-synced automatically whenever the underlying auth state changes.
 */
export async function setClientEmailVerified(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const clientId = asString(formData.get("clientId"));
  const valueRaw = asString(formData.get("emailVerified"));

  if (!clientId) {
    return { ok: false, error: "Missing client." };
  }
  if (valueRaw !== "true" && valueRaw !== "false") {
    return { ok: false, error: "Invalid email verification value." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("admin_set_client_email_verified", {
    p_client_id: clientId,
    p_email_verified: valueRaw === "true",
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateClient(clientId);
  return { ok: true };
}

export async function saveClientAvatar(
  clientId: string,
  avatarUrl: string | null,
): Promise<ActionResult> {
  await requireAdmin();
  if (!clientId) {
    return { ok: false, error: "Missing client." };
  }
  if (avatarUrl && !isValidHttpUrl(avatarUrl)) {
    return { ok: false, error: "Avatar must be a valid http(s) URL." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: existing, error: lookupError } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", clientId)
    .maybeSingle();
  if (lookupError) {
    return { ok: false, error: lookupError.message };
  }
  if (!existing) {
    return { ok: false, error: "Client not found." };
  }

  const previous = (existing as { avatar_url: string | null }).avatar_url;
  const { error } = await supabase.rpc("admin_set_client_avatar_url", {
    p_client_id: clientId,
    p_avatar_url: avatarUrl,
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  if (previous && previous !== avatarUrl) {
    await removeStorageObject(previous);
  }

  revalidateClient(clientId);
  return { ok: true };
}
