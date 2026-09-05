import { supabaseUrl } from "@/lib/supabase/env";

const cleanSupabaseUrl = (supabaseUrl || "").replace(/[\r\n\s]+/g, "");

export const PHOTOS_BUCKET = "photos";
export const LEGACY_PORTFOLIO_IMAGE_BUCKET = "portfolio-images";

export const PHOTO_FOLDERS = [
  "portfolio",
  "services",
  "reviews",
  "profile",
  "projects",
  "clients",
] as const;

export type PhotoFolder = (typeof PHOTO_FOLDERS)[number];

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

export function isPhotoFolder(value: string): value is PhotoFolder {
  return (PHOTO_FOLDERS as readonly string[]).includes(value);
}

export function safeFileName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}

export function isValidImageFile(file: File): string | null {
  if (file.size === 0) {
    return "Choose a non-empty image file.";
  }
  if (file.size > PHOTO_MAX_BYTES) {
    return `Image must be smaller than ${Math.round(PHOTO_MAX_BYTES / 1024 / 1024)} MB.`;
  }
  const mime = file.type === "image/jpg" ? "image/jpeg" : file.type;
  if (mime && !(PHOTO_MIME_TYPES as readonly string[]).includes(mime)) {
    return "Unsupported image type. Use PNG, JPEG, WebP, GIF or AVIF.";
  }
  return null;
}

export function buildPhotoObjectPath(
  folder: PhotoFolder,
  fileName: string,
  entityId?: string | null,
): string {
  const idPart = entityId?.trim() ? `${entityId.trim()}/` : "";
  return `${folder}/${idPart}${Date.now()}-${safeFileName(fileName)}`;
}

export function photosPublicUrl(path: string): string {
  const cleanPath = path.replace(/[\r\n\s]+/g, "");
  return `${cleanSupabaseUrl}/storage/v1/object/public/${PHOTOS_BUCKET}/${cleanPath}`;
}

export function parseStorageObject(
  imageUrl: string | null | undefined,
): { bucket: string; path: string } | null {
  if (!imageUrl || !cleanSupabaseUrl) {
    return null;
  }

  const trimmed = imageUrl.replace(/[\r\n\s]+/g, "");
  if (!trimmed) {
    return null;
  }

  const prefixes = [
    `${cleanSupabaseUrl}/storage/v1/object/public/`,
    `${cleanSupabaseUrl}/storage/v1/object/sign/`,
    `${cleanSupabaseUrl}/storage/v1/object/authenticated/`,
  ];

  for (const prefix of prefixes) {
    if (!trimmed.startsWith(prefix)) {
      continue;
    }
    const rest = trimmed.slice(prefix.length).split("?")[0] ?? "";
    const slash = rest.indexOf("/");
    if (slash <= 0) {
      return null;
    }
    return {
      bucket: decodeURIComponent(rest.slice(0, slash)),
      path: rest
        .slice(slash + 1)
        .split("/")
        .map((segment) => decodeURIComponent(segment))
        .join("/"),
    };
  }

  return null;
}

export function isManagedPhotoUrl(imageUrl: string | null | undefined): boolean {
  const object = parseStorageObject(imageUrl);
  return Boolean(
    object &&
      (object.bucket === PHOTOS_BUCKET || object.bucket === LEGACY_PORTFOLIO_IMAGE_BUCKET),
  );
}

export function resolvePublicImageUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.replace(/[\r\n\s]+/g, "");
  if (!trimmed) {
    return null;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (PHOTO_FOLDERS.some((folder) => trimmed.startsWith(`${folder}/`))) {
    return photosPublicUrl(trimmed);
  }
  return trimmed;
}
