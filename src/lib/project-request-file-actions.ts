"use server";

import { revalidatePath } from "next/cache";
import { canClientEditRequest } from "@/lib/admin-project-request-constants";
import { fileFieldCategory, fileFieldMaxFiles } from "@/lib/order-form";
import { getOrderFormConfig } from "@/lib/order-form-server";
import {
  buildProjectRequestObjectPath,
  isValidProjectRequestFile,
  projectRequestFileCategory,
  PROJECT_REQUEST_FILE_BUCKET,
  PROJECT_REQUEST_MAX_FILES,
  resolveProjectRequestFileMime,
  type ProjectRequestFileSummary,
} from "@/lib/project-request-files";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { FileCategory, RequestStatus } from "@/types/database";

export type ProjectRequestFileActionResult =
  | { ok: true; file: ProjectRequestFileSummary }
  | { ok: false; error: string; unauthenticated?: true };

export type ProjectRequestFileDeleteResult =
  | { ok: true }
  | { ok: false; error: string; unauthenticated?: true };

export type ListProjectRequestFilesResult =
  | { ok: true; files: ProjectRequestFileSummary[] }
  | { ok: false; error: string; unauthenticated?: true };

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function isMissingColumn(error: { message?: string; code?: string } | null): boolean {
  if (!error) {
    return false;
  }
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find the")
  );
}

function revalidateRequest(requestId: string) {
  revalidatePath("/profile");
  revalidatePath(`/profile/project-requests/${requestId}`);
  revalidatePath(`/profile/project-requests/${requestId}/edit`);
}

function toSummary(row: {
  id: string;
  original_name: string;
  category: FileCategory | string;
  file_size_bytes: number | null;
  created_at: string;
  bucket_name: string;
  storage_path: string;
  uploaded_by?: string | null;
  form_field_key?: string | null;
}): ProjectRequestFileSummary {
  return {
    id: row.id,
    original_name: row.original_name,
    category: row.category,
    file_size_bytes: row.file_size_bytes,
    created_at: row.created_at,
    bucket_name: row.bucket_name,
    storage_path: row.storage_path,
    uploaded_by: row.uploaded_by ?? null,
    form_field_key: row.form_field_key ?? null,
  };
}

async function requireOwnedRequest(requestId: string) {
  if (!isSupabaseConfigured()) {
    return {
      ok: false as const,
      error: "Project requests are not configured yet. Please try again later.",
    };
  }

  const trimmedId = requestId.trim();
  if (!trimmedId) {
    return { ok: false as const, error: "Missing request." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false as const,
      unauthenticated: true as const,
      error: "Sign in to attach files to this request.",
    };
  }

  const { data: request, error } = await supabase
    .from("project_requests")
    .select("id, client_id, status")
    .eq("id", trimmedId)
    .eq("client_id", user.id)
    .maybeSingle();

  if (error) {
    return { ok: false as const, error: error.message };
  }
  if (!request || request.client_id !== user.id) {
    return { ok: false as const, error: "Request not found." };
  }

  return { ok: true as const, supabase, user, request };
}

export async function listOwnProjectRequestFiles(
  requestId: string,
): Promise<ListProjectRequestFilesResult> {
  const owned = await requireOwnedRequest(requestId);
  if (!owned.ok) {
    return owned;
  }

  const withKey = await owned.supabase
    .from("project_files")
    .select(
      "id, original_name, category, file_size_bytes, created_at, bucket_name, storage_path, uploaded_by, project_request_id, form_field_key",
    )
    .eq("project_request_id", owned.request.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const result = withKey.error && isMissingColumn(withKey.error)
    ? await owned.supabase
        .from("project_files")
        .select(
          "id, original_name, category, file_size_bytes, created_at, bucket_name, storage_path, uploaded_by, project_request_id",
        )
        .eq("project_request_id", owned.request.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
    : withKey;

  const { data, error } = result;

  if (error) {
    if (isMissingColumn(error)) {
      return { ok: true, files: [] };
    }
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    files: (data ?? []).map(toSummary),
  };
}

export async function uploadProjectRequestFile(
  formData: FormData,
): Promise<ProjectRequestFileActionResult> {
  const requestId = asString(formData.get("requestId"));
  const owned = await requireOwnedRequest(requestId);
  if (!owned.ok) {
    return owned;
  }

  if (!canClientEditRequest(owned.request.status as RequestStatus)) {
    return { ok: false, error: "Files can no longer be added to this request." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "Choose a file to upload." };
  }

  const fileError = isValidProjectRequestFile(file);
  if (fileError) {
    return { ok: false, error: fileError };
  }

  const fieldKey = asString(formData.get("fieldKey"));
  let categoryHint: string | null = asString(formData.get("category")) || null;
  let fieldLimit = PROJECT_REQUEST_MAX_FILES;
  if (fieldKey) {
    const configResult = await getOrderFormConfig();
    if (configResult.status === "ok") {
      const field = configResult.data.fields.find((item) => item.fieldKey === fieldKey);
      if (field?.inputType === "file") {
        categoryHint = fileFieldCategory(field);
        fieldLimit = fileFieldMaxFiles(field);
      }
    }
  }

  let countQuery = owned.supabase
    .from("project_files")
    .select("id", { count: "exact", head: true })
    .eq("project_request_id", owned.request.id)
    .eq("uploaded_by", owned.user.id)
    .is("deleted_at", null);
  if (fieldKey) {
    countQuery = countQuery.eq("form_field_key", fieldKey);
  }
  const { count, error: countError } = await countQuery;

  if (countError && !isMissingColumn(countError)) {
    return { ok: false, error: countError.message };
  }
  if ((count ?? 0) >= fieldLimit) {
    return {
      ok: false,
      error:
        fieldLimit === 1
          ? "You can attach 1 file here."
          : `You can attach up to ${fieldLimit} files here.`,
    };
  }

  const mimeType = resolveProjectRequestFileMime(file);
  const storagePath = buildProjectRequestObjectPath(
    owned.user.id,
    owned.request.id,
    file.name,
  );

  const { error: uploadError } = await owned.supabase.storage
    .from(PROJECT_REQUEST_FILE_BUCKET)
    .upload(storagePath, file, {
      contentType: mimeType || undefined,
      upsert: false,
    });

  if (uploadError) {
    return {
      ok: false,
      error: `Could not upload ${file.name}. ${uploadError.message}`,
    };
  }

  const insertPayload: Record<string, unknown> = {
    bucket_name: PROJECT_REQUEST_FILE_BUCKET,
    storage_path: storagePath,
    original_name: file.name,
    mime_type: mimeType || null,
    file_size_bytes: file.size,
    category: projectRequestFileCategory(mimeType, categoryHint),
    uploaded_by: owned.user.id,
    project_request_id: owned.request.id,
    is_public: true,
  };
  if (fieldKey) {
    insertPayload.form_field_key = fieldKey;
  }

  const { data: inserted, error: insertError } = await owned.supabase
    .from("project_files")
    .insert(insertPayload)
    .select(
      "id, original_name, category, file_size_bytes, created_at, bucket_name, storage_path, uploaded_by, form_field_key",
    )
    .single();

  if (insertError && isMissingColumn(insertError) && fieldKey) {
    delete insertPayload.form_field_key;
    const retry = await owned.supabase
      .from("project_files")
      .insert(insertPayload)
      .select(
        "id, original_name, category, file_size_bytes, created_at, bucket_name, storage_path, uploaded_by",
      )
      .single();
    if (!retry.error && retry.data) {
      revalidateRequest(owned.request.id);
      return { ok: true, file: toSummary(retry.data) };
    }
  }

  if (insertError) {
    await owned.supabase.storage
      .from(PROJECT_REQUEST_FILE_BUCKET)
      .remove([storagePath]);
    if (isMissingColumn(insertError)) {
      return {
        ok: false,
        error: `Could not save ${file.name}. File metadata is not available yet.`,
      };
    }
    return {
      ok: false,
      error: `Could not save ${file.name}. ${insertError.message}`,
    };
  }

  revalidateRequest(owned.request.id);
  return { ok: true, file: toSummary(inserted) };
}

export async function deleteOwnProjectRequestFile(
  requestId: string,
  fileId: string,
): Promise<ProjectRequestFileDeleteResult> {
  const owned = await requireOwnedRequest(requestId);
  if (!owned.ok) {
    return owned;
  }

  if (!canClientEditRequest(owned.request.status as RequestStatus)) {
    return { ok: false, error: "Files can no longer be removed from this request." };
  }

  const trimmedFileId = fileId.trim();
  if (!trimmedFileId) {
    return { ok: false, error: "Missing file." };
  }

  const { data: file, error: lookupError } = await owned.supabase
    .from("project_files")
    .select("id, bucket_name, storage_path, uploaded_by, project_request_id")
    .eq("id", trimmedFileId)
    .eq("project_request_id", owned.request.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (lookupError) {
    if (isMissingColumn(lookupError)) {
      return { ok: false, error: "File metadata is not available yet." };
    }
    return { ok: false, error: lookupError.message };
  }
  if (!file) {
    return { ok: false, error: "File not found." };
  }
  if (file.uploaded_by && file.uploaded_by !== owned.user.id) {
    return { ok: false, error: "You can only remove files you uploaded." };
  }

  await owned.supabase.storage.from(file.bucket_name).remove([file.storage_path]);

  let updateQuery = owned.supabase
    .from("project_files")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", trimmedFileId)
    .eq("project_request_id", owned.request.id);

  updateQuery = file.uploaded_by
    ? updateQuery.eq("uploaded_by", owned.user.id)
    : updateQuery.is("uploaded_by", null);

  const { error } = await updateQuery;

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateRequest(owned.request.id);
  return { ok: true };
}
