import { PHOTOS_BUCKET, safeFileName } from "@/lib/photos";
import type { FileCategory } from "@/types/database";

export const PROJECT_REQUEST_FILE_BUCKET = PHOTOS_BUCKET;
export const PROJECT_REQUEST_FILE_FOLDER = "project-requests";
export const PROJECT_REQUEST_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const PROJECT_REQUEST_MAX_FILES = 10;

export const PROJECT_REQUEST_FILE_ACCEPT = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".svg",
  ".pdf",
  ".zip",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "application/zip",
].join(",");

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  zip: "application/zip",
};

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-zip",
]);

export type ProjectRequestFileSummary = {
  id: string;
  original_name: string;
  category: string;
  file_size_bytes: number | null;
  created_at: string;
  bucket_name: string;
  storage_path: string;
  uploaded_by?: string | null;
};

export function fileExtension(name: string): string {
  const trimmed = name.trim();
  const index = trimmed.lastIndexOf(".");
  if (index < 0 || index === trimmed.length - 1) {
    return "";
  }
  return trimmed.slice(index + 1).toLowerCase();
}

export function resolveProjectRequestFileMime(file: Pick<File, "name" | "type">): string {
  const mime = file.type === "image/jpg" ? "image/jpeg" : file.type;
  if (mime && ALLOWED_MIME_TYPES.has(mime)) {
    return mime === "image/jpg" ? "image/jpeg" : mime;
  }
  return MIME_BY_EXTENSION[fileExtension(file.name)] ?? mime;
}

export function projectRequestFileCategory(mimeType: string): FileCategory {
  if (mimeType === "image/svg+xml" || mimeType.startsWith("image/")) {
    return "design";
  }
  if (mimeType === "application/pdf") {
    return "document";
  }
  if (
    mimeType === "application/zip" ||
    mimeType === "application/x-zip-compressed" ||
    mimeType === "application/x-zip"
  ) {
    return "attachment";
  }
  return "other";
}

export function isValidProjectRequestFile(file: File): string | null {
  if (file.size === 0) {
    return `${file.name} is empty.`;
  }
  if (file.size > PROJECT_REQUEST_MAX_FILE_BYTES) {
    return `${file.name} must be smaller than ${Math.round(PROJECT_REQUEST_MAX_FILE_BYTES / 1024 / 1024)} MB.`;
  }
  const mime = resolveProjectRequestFileMime(file);
  if (!mime || !ALLOWED_MIME_TYPES.has(mime)) {
    return `${file.name} is not a supported type. Use JPG, PNG, WEBP, SVG, PDF, or ZIP.`;
  }
  return null;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes < 0) {
    return "0 B";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

export function buildProjectRequestObjectPath(
  userId: string,
  requestId: string,
  fileName: string,
): string {
  return [
    PROJECT_REQUEST_FILE_FOLDER,
    userId,
    requestId,
    `${Date.now()}-${crypto.randomUUID()}-${safeFileName(fileName)}`,
  ].join("/");
}
