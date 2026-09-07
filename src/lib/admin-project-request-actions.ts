"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isRequestStatus } from "@/lib/admin-project-request-constants";
import type { RequestStatus } from "@/types/database";

type ActionResult =
  | { ok: true; projectId?: string }
  | { ok: false; error: string };

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function revalidateRequest(requestId: string, projectId?: string) {
  revalidatePath("/admin/project-requests");
  revalidatePath(`/admin/project-requests/${requestId}`);
  revalidatePath("/admin/projects");
  revalidatePath("/profile");
  if (projectId) {
    revalidatePath(`/admin/projects/${projectId}`);
    revalidatePath(`/profile/projects/${projectId}`);
  }
}

export async function updateProjectRequestStatus(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const requestId = asString(formData.get("requestId"));
  const statusRaw = asString(formData.get("status"));

  if (!requestId) {
    return { ok: false, error: "Missing request." };
  }
  if (!isRequestStatus(statusRaw)) {
    return { ok: false, error: "Invalid request status." };
  }
  if (statusRaw === "converted") {
    return {
      ok: false,
      error: "A request becomes converted when the client accepts a quote.",
    };
  }

  const supabase = await createServerSupabaseClient();
  const { data: existing, error: lookupError } = await supabase
    .from("project_requests")
    .select("id, status")
    .eq("id", requestId)
    .maybeSingle();

  if (lookupError) {
    return { ok: false, error: lookupError.message };
  }
  if (!existing) {
    return { ok: false, error: "Request not found." };
  }
  if (existing.status === "converted") {
    return {
      ok: false,
      error: "Converted requests cannot change status. Open the linked project instead.",
    };
  }

  const nextStatus = statusRaw as RequestStatus;
  const { error } = await supabase
    .from("project_requests")
    .update({ status: nextStatus })
    .eq("id", requestId)
    .neq("status", "converted");

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateRequest(requestId);
  return { ok: true };
}

export async function convertProjectRequest(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const requestId = asString(formData.get("requestId"));

  if (!requestId) {
    return { ok: false, error: "Missing request." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: existingRows, error: existingError } = await supabase
    .from("projects")
    .select("id")
    .eq("request_id", requestId)
    .limit(2);

  if (existingError) {
    return { ok: false, error: existingError.message };
  }

  if (existingRows && existingRows.length > 0) {
    return {
      ok: false,
      error: "This request is already linked to a project.",
    };
  }

  return {
    ok: false,
    error:
      "Projects are created when the client accepts a quote. Create and send a quote from this request instead.",
  };
}
