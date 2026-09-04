"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import {
  applyContactAction,
  isContactInboxAction,
  type ContactInboxAction,
} from "@/lib/admin-contact-constants";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { ok: false; error: string };

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

async function applyAction(messageId: string, action: ContactInboxAction): Promise<ActionResult> {
  if (!messageId) {
    return { ok: false, error: "Missing message." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: message, error } = await supabase
    .from("contact_messages")
    .select("id, status, read_at, replied_at")
    .eq("id", messageId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!message) {
    return { ok: false, error: "Message not found." };
  }

  const outcome = applyContactAction(message, action);
  if (!outcome.ok) {
    return { ok: false, error: outcome.reason };
  }

  const { error: updateError } = await supabase
    .from("contact_messages")
    .update(outcome.updates)
    .eq("id", messageId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  revalidatePath("/admin/contact-messages");
  return { ok: true };
}

/**
 * Open (read) a message. Fires when an admin opens a message detail view:
 * a message in state "new" transitions to "read" and read_at is set exactly
 * once (idempotent — never overwrites an existing read_at).
 */
export async function openContactMessage(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  return applyAction(asString(formData.get("messageId")), "read");
}

/** Mark as replied, archive, mark as spam, or restore an inbox message. */
export async function setContactMessageStatus(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const messageId = asString(formData.get("messageId"));
  const actionRaw = asString(formData.get("action"));

  if (!isContactInboxAction(actionRaw)) {
    return { ok: false, error: "Invalid inbox action." };
  }
  return applyAction(messageId, actionRaw);
}
