"use server";

import { revalidatePath } from "next/cache";
import {
  canClientCancelRequest,
  canClientEditRequest,
} from "@/lib/admin-project-request-constants";
import {
  getNormalizedProjectRequest,
  toClientProjectRequestPayload,
  validateProjectRequest,
} from "@/lib/project-request";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Json, RequestStatus } from "@/types/database";
import type { OrderFormConfig, ProjectRequest } from "@/types/project-request";

export type CancelProjectRequestResult =
  | { ok: true }
  | { ok: false; error: string };

export type UpdateProjectRequestResult =
  | { ok: true; requestNumber: string; requestId: string }
  | { ok: false; error: string; unauthenticated?: true };

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
  revalidatePath(`/profile/project-requests/${requestId}`);
  return { ok: true };
}

export async function updateOwnProjectRequest(
  requestId: string,
  data: ProjectRequest,
  config: OrderFormConfig,
  serviceId: string | null,
): Promise<UpdateProjectRequestResult> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: "Project requests are not configured yet. Please try again later.",
    };
  }

  const trimmedId = requestId.trim();
  if (!trimmedId) {
    return { ok: false, error: "Missing request." };
  }

  const errors = validateProjectRequest(data, config);
  if (Object.keys(errors).length > 0) {
    return {
      ok: false,
      error: "Please complete the required fields before submitting.",
    };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      unauthenticated: true,
      error: "Sign in to update this request.",
    };
  }

  const { data: existing, error: lookupError } = await supabase
    .from("project_requests")
    .select("id, client_id, status, request_number")
    .eq("id", trimmedId)
    .eq("client_id", user.id)
    .maybeSingle();

  if (lookupError) {
    return { ok: false, error: lookupError.message };
  }
  if (!existing || existing.client_id !== user.id) {
    return { ok: false, error: "Request not found." };
  }
  if (!canClientEditRequest(existing.status as RequestStatus)) {
    return { ok: false, error: "This request can no longer be edited." };
  }

  const { data: linkedProject } = await supabase
    .from("projects")
    .select("id")
    .eq("request_id", trimmedId)
    .maybeSingle();

  if (linkedProject) {
    return { ok: false, error: "This request can no longer be edited." };
  }

  const payload = toClientProjectRequestPayload(
    getNormalizedProjectRequest(data),
    config,
    serviceId,
  );

  const { error } = await supabase.rpc("update_own_project_request", {
    p_request_id: trimmedId,
    p_payload: payload as Json,
  });

  if (error) {
    return {
      ok: false,
      error: error.message || "Could not update this request.",
    };
  }

  revalidatePath("/profile");
  revalidatePath(`/profile/project-requests/${trimmedId}`);
  revalidatePath(`/profile/project-requests/${trimmedId}/edit`);
  return {
    ok: true,
    requestId: existing.id,
    requestNumber: existing.request_number,
  };
}
