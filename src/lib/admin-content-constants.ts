import type { QueryResult } from "@/lib/admin-project-constants";
import {
  PHOTO_MAX_BYTES,
  PHOTO_MIME_TYPES,
  PHOTOS_BUCKET,
} from "@/lib/photos";
import type {
  PortfolioProjectImageRow,
  PortfolioProjectRow,
  ServiceFeatureRow,
  ServiceRow,
} from "@/types/database";

export { formatDate, formatDateTime } from "@/lib/admin-project-constants";
export { isValidImageFile } from "@/lib/photos";
export type { QueryResult };

/** Storage bucket used for admin CMS photos (dashboard-created, public read). */
export const PORTFOLIO_IMAGE_BUCKET = PHOTOS_BUCKET;
export const CONTENT_IMAGE_MAX_BYTES = PHOTO_MAX_BYTES;
export const CONTENT_IMAGE_MIME_TYPES = PHOTO_MIME_TYPES;

export const PORTFOLIO_CATEGORY_SUGGESTIONS = [
  "Business",
  "Portfolio",
  "E-commerce",
  "Landing",
  "Custom",
] as const;

export const CONTENT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type ContentListFilters = {
  q?: string;
  published?: string;
  featured?: string;
};

export type PortfolioProjectWithImages = PortfolioProjectRow & {
  images: PortfolioProjectImageRow[];
};

export type ServiceWithFeatures = ServiceRow & {
  features: ServiceFeatureRow[];
};

/** Lowercase/hyphenate arbitrary text into a slug-shaped candidate. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Strict check for an already-slug-shaped value (used on save). */
export function isValidSlugFormat(value: string): boolean {
  return value.length <= 80 && CONTENT_SLUG_PATTERN.test(value);
}

export function isValidHttpUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return true;
  }
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function buildPortfolioHref(filters: ContentListFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.published && filters.published !== "all") params.set("published", filters.published);
  if (filters.featured && filters.featured !== "all") params.set("featured", filters.featured);
  const query = params.toString();
  return query ? `/admin/portfolio?${query}` : "/admin/portfolio";
}

export function buildServicesHref(filters: ContentListFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.published && filters.published !== "all") params.set("published", filters.published);
  if (filters.featured && filters.featured !== "all") params.set("featured", filters.featured);
  const query = params.toString();
  return query ? `/admin/services?${query}` : "/admin/services";
}
