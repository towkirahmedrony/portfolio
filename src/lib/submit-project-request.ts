"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  generateRequestNumber,
  toProjectRequestInsert,
  validateProjectRequest,
} from "@/lib/project-request";
import type { OrderFormConfig, ProjectRequest } from "@/types/project-request";

const UNIQUE_VIOLATION = "23505";
const MAX_REQUEST_NUMBER_ATTEMPTS = 5;

export type SubmitProjectRequestResult =
  | { ok: true; requestNumber: string; requestId: string }
  | { ok: false; error: string; unauthenticated?: true };

function uniqueViolation(error: { code?: string; message?: string }): boolean {
  if (error.code === UNIQUE_VIOLATION) {
    return true;
  }

  return (error.message ?? "").toLowerCase().includes("duplicate");
}

export async function submitProjectRequest(
  data: ProjectRequest,
  config: OrderFormConfig,
  serviceId: string | null,
): Promise<SubmitProjectRequestResult> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: "Project requests are not configured yet. Please try again later.",
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
      error: "Sign in or create an account to place this order.",
    };
  }

  const errors = validateProjectRequest(data, config);
  if (Object.keys(errors).length > 0) {
    return {
      ok: false,
      error: errors.phone ?? "Please complete the required fields before submitting.",
    };
  }

  const payload = toProjectRequestInsert(
    data,
    generateRequestNumber(),
    config,
    serviceId,
  );

  if (!payload.phone || payload.phone.trim().length === 0) {
    return {
      ok: false,
      error: "Please enter your phone number.",
    };
  }

  // TEMP DEBUG: remove once the submit error is found.
  console.error("submitProjectRequest payload:", JSON.stringify(payload, null, 2));

  for (let attempt = 0; attempt < MAX_REQUEST_NUMBER_ATTEMPTS; attempt += 1) {
    const insertPayload =
      attempt === 0
        ? payload
        : { ...payload, request_number: generateRequestNumber() };

    const { data: inserted, error } = await supabase
      .from("project_requests")
      .insert(insertPayload)
      .select("id, request_number")
      .single();

    if (!error && inserted) {
      revalidatePath("/profile");
      revalidatePath(`/profile/project-requests/${inserted.id}`);
      return {
        ok: true,
        requestId: inserted.id,
        requestNumber: inserted.request_number ?? insertPayload.request_number ?? generateRequestNumber(),
      };
    }

    if (error) {
      console.error("submitProjectRequest insert failed:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
    }

    if (error && uniqueViolation(error) && attempt < MAX_REQUEST_NUMBER_ATTEMPTS - 1) {
      continue;
    }

    return {
      ok: false,
      error: "Could not submit your project request. Please try again.",
    };
  }

  return {
    ok: false,
    error: "Could not submit your project request. Please try again.",
  };
}
