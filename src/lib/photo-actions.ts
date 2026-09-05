"use server";

import { requireAdmin } from "@/lib/require-admin";
import {
  buildPhotoObjectPath,
  isPhotoFolder,
  isValidImageFile,
  PHOTOS_BUCKET,
  photosPublicUrl,
  type PhotoFolder,
} from "@/lib/photos";
import { removeStorageObject } from "@/lib/photo-storage";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type PhotoUploadResult =
  | { ok: true; url: string; path: string }
  | { ok: false; error: string };

export type PhotoActionResult = { ok: true } | { ok: false; error: string };

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function uploadAdminPhoto(formData: FormData): Promise<PhotoUploadResult> {
  await requireAdmin();

  const folderRaw = asString(formData.get("folder"));
  const entityId = asString(formData.get("entityId")) || null;
  const previousUrl = asString(formData.get("previousUrl")) || null;
  const file = formData.get("file");

  if (!isPhotoFolder(folderRaw)) {
    return { ok: false, error: "Invalid photo folder." };
  }
  if (!(file instanceof File)) {
    return { ok: false, error: "Choose an image to upload." };
  }
  const fileError = isValidImageFile(file);
  if (fileError) {
    return { ok: false, error: fileError };
  }

  const folder: PhotoFolder = folderRaw;
  const storagePath = buildPhotoObjectPath(folder, file.name, entityId);
  const supabase = await createServerSupabaseClient();
  const { error: uploadError } = await supabase.storage.from(PHOTOS_BUCKET).upload(storagePath, file, {
    contentType: file.type || undefined,
    upsert: false,
  });

  if (uploadError) {
    return {
      ok: false,
      error: `Upload failed: ${uploadError.message}. Confirm the "${PHOTOS_BUCKET}" bucket exists and allows admin uploads.`,
    };
  }

  if (previousUrl) {
    await removeStorageObject(previousUrl);
  }

  return {
    ok: true,
    url: photosPublicUrl(storagePath),
    path: storagePath,
  };
}

export async function deleteAdminPhoto(formData: FormData): Promise<PhotoActionResult> {
  await requireAdmin();
  const imageUrl = asString(formData.get("imageUrl"));
  if (!imageUrl) {
    return { ok: true };
  }

  await removeStorageObject(imageUrl);
  return { ok: true };
}
