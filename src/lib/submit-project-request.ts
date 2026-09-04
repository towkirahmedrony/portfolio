import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  generateRequestNumber,
  toProjectRequestInsert,
} from "@/lib/project-request";
import type { ProjectRequest } from "@/types/project-request";

const UNIQUE_VIOLATION = "23505";
const MAX_REQUEST_NUMBER_ATTEMPTS = 5;

export type SubmitProjectRequestResult =
  | { ok: true; requestNumber: string }
  | { ok: false; error: string };

function uniqueViolation(error: { code?: string; message?: string }): boolean {
  if (error.code === UNIQUE_VIOLATION) {
    return true;
  }

  return (error.message ?? "").toLowerCase().includes("duplicate");
}

export async function submitProjectRequest(
  data: ProjectRequest,
): Promise<SubmitProjectRequestResult> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: "Project requests are not configured yet. Please try again later.",
    };
  }

  const supabase = createBrowserSupabaseClient();
  await supabase.auth.getUser();
  const payload = toProjectRequestInsert(data, generateRequestNumber());

  for (let attempt = 0; attempt < MAX_REQUEST_NUMBER_ATTEMPTS; attempt += 1) {
    const insertPayload =
      attempt === 0
        ? payload
        : { ...payload, request_number: generateRequestNumber() };

    const { error } = await supabase
      .from("project_requests")
      .insert(insertPayload);

    if (!error) {
      return {
        ok: true,
        requestNumber: insertPayload.request_number ?? generateRequestNumber(),
      };
    }

    if (uniqueViolation(error) && attempt < MAX_REQUEST_NUMBER_ATTEMPTS - 1) {
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
