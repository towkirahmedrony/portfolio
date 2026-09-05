"use server";

import { revalidatePath } from "next/cache";
import { canClientCancelRequest } from "@/lib/admin-project-request-constants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { RequestStatus } from "@/types/database";

export type CancelProjectRequestResult =
  | { ok: true }
  | { ok: false; error: string };

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function cancelOwnProjectRequest(
  formData: FormData,
): Promise<CancelProjectRequestResult> {
  const requestId = asString(formData.get("requestId"));
  if (!requestId) {
    return { ok: false, error: "Missing request." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You need to be signed in." };
  }

  const { data: existing, error: lookupError } = await supabase
    .from("project_requests")
    .select("id, client_id, status")
    .eq("id", requestId)
    .eq("client_id", user.id)
    .maybeSingle();

  if (lookupError) {
    return { ok: false, error: lookupError.message };
  }
  if (!existing || existing.client_id !== user.id) {
    return { ok: false, error: "Request not found." };
  }
  if (!canClientCancelRequest(existing.status as RequestStatus)) {
    return { ok: false, error: "This request can no longer be cancelled." };
  }

  const { error } = await supabase.rpc("cancel_own_project_request", {
    p_request_id: requestId,
  });

  if (error) {
    return {
      ok: false,
      error: error.message || "Could not cancel this request.",
    };
  }

  revalidatePath("/profile");
  return { ok: true };
}
