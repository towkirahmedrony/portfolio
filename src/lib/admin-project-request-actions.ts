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
      error: "Use Convert to Project to mark a request as converted.",
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
  const { data: existing } = await supabase
    .from("projects")
    .select("id")
    .eq("request_id", requestId)
    .maybeSingle();

  if (existing?.id) {
    return {
      ok: false,
      error: "This request has already been converted to a project.",
    };
  }

  const { data, error } = await supabase.rpc("admin_convert_project_request", {
    p_request_id: requestId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const projectId = typeof data === "string" && data ? data : undefined;
  revalidateRequest(requestId, projectId);
  return { ok: true, projectId };
}
