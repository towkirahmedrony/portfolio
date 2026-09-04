"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/require-admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { supabaseUrl } from "@/lib/supabase/env";
import {
  isValidHttpUrl,
  isValidImageFile,
  isValidSlugFormat,
  PORTFOLIO_IMAGE_BUCKET,
  slugify,
} from "@/lib/admin-content-constants";

type ActionResult = { ok: true } | { ok: false; error: string };

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalString(value: FormDataEntryValue | null): string | null {
  const next = asString(value);
  return next ? next : null;
}

function asOptionalNumber(value: FormDataEntryValue | null): number | null {
  const raw = asString(value);
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function asOptionalInteger(value: FormDataEntryValue | null): number | null {
  const parsed = asOptionalNumber(value);
  return parsed == null ? null : Math.trunc(parsed);
}

function asCheckbox(value: FormDataEntryValue | null): boolean {
  return value === "on";
}

function parseStringList(value: string): string[] {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function safeFileName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}

function storageObjectPath(imageUrl: string): { bucket: string; path: string } | null {
  const prefix = `${supabaseUrl}/storage/v1/object/public/`;
  if (!imageUrl.startsWith(prefix)) {
    return null;
  }
  const rest = imageUrl.slice(prefix.length);
  const slash = rest.indexOf("/");
  if (slash <= 0) {
    return null;
  }
  return { bucket: rest.slice(0, slash), path: rest.slice(slash + 1) };
}

function storagePublicUrl(bucket: string, path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

async function assertUniqueSlug(
  table: "portfolio_projects" | "services",
  slug: string,
  excludeId: string | null,
): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  let query = supabase.from(table).select("id").eq("slug", slug);
  if (excludeId) {
    query = query.neq("id", excludeId);
  }
  const { data } = await query.limit(1);
  if (data && data.length > 0) {
    return "That slug is already in use.";
  }
  return null;
}

function validateUrls(
  liveUrl: string | null,
  githubUrl: string | null,
  thumbnailUrl: string | null,
): string | null {
  for (const url of [liveUrl, githubUrl, thumbnailUrl]) {
    if (url && !isValidHttpUrl(url)) {
      return "Live URL, GitHub URL and thumbnail must be valid http(s) URLs.";
    }
  }
  return null;
}

// ── Portfolio ─────────────────────────────────────────────────────────────

export async function savePortfolioProject(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const id = asOptionalString(formData.get("id"));
  const title = asString(formData.get("title"));
  const slugRaw = asString(formData.get("slug"));
  const slug = slugRaw ? slugify(slugRaw) : slugify(title);
  const shortDescription = asOptionalString(formData.get("short_description"));
  const description = asOptionalString(formData.get("description"));
  const category = asOptionalString(formData.get("category"));
  const technologies = parseStringList(asString(formData.get("technologies")));
  const liveUrl = asOptionalString(formData.get("live_url"));
  const githubUrl = asOptionalString(formData.get("github_url"));
  const thumbnailUrl = asOptionalString(formData.get("thumbnail_url"));
  const featured = asCheckbox(formData.get("featured"));
  const published = asCheckbox(formData.get("published"));
  const sortOrder = asOptionalInteger(formData.get("sort_order")) ?? 0;

  if (!title) {
    return { ok: false, error: "Title is required." };
  }
  if (!slug || !isValidSlugFormat(slug)) {
    return {
      ok: false,
      error: "Slug is required and must be lowercase letters, numbers and hyphens (e.g. my-project).",
    };
  }
  const urlError = validateUrls(liveUrl, githubUrl, thumbnailUrl);
  if (urlError) {
    return { ok: false, error: urlError };
  }

  const uniqueError = await assertUniqueSlug("portfolio_projects", slug, id);
  if (uniqueError) {
    return { ok: false, error: uniqueError };
  }

  const payload = {
    title,
    slug,
    short_description: shortDescription,
    description,
    category,
    technologies,
    live_url: liveUrl,
    github_url: githubUrl,
    thumbnail_url: thumbnailUrl,
    featured,
    published,
    sort_order: sortOrder,
  };

  const supabase = await createServerSupabaseClient();
  const { data: saved, error } = id
    ? await supabase
        .from("portfolio_projects")
        .update(payload)
        .eq("id", id)
        .select("id")
        .maybeSingle()
    : await supabase
        .from("portfolio_projects")
        .insert(payload)
        .select("id")
        .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!saved) {
    return { ok: false, error: "Project not found." };
  }

  revalidatePath("/admin/portfolio");
  revalidatePath(`/admin/portfolio/${saved.id}`);
  if (!id) {
    redirect(`/admin/portfolio/${saved.id}`);
  }
  return { ok: true };
}

export async function setPortfolioFlag(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = asString(formData.get("projectId"));
  const flag = asString(formData.get("flag"));
  const valueRaw = asString(formData.get("value"));

  if (!id) {
    return { ok: false, error: "Missing project." };
  }
  if (flag !== "featured" && flag !== "published") {
    return { ok: false, error: "Invalid flag." };
  }
  if (valueRaw !== "true" && valueRaw !== "false") {
    return { ok: false, error: "Invalid flag value." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("portfolio_projects")
    .update(flag === "featured" ? { featured: valueRaw === "true" } : { published: valueRaw === "true" })
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/portfolio");
  revalidatePath(`/admin/portfolio/${id}`);
  return { ok: true };
}

export async function reorderPortfolioProject(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = asString(formData.get("projectId"));
  const direction = asString(formData.get("direction"));

  if (!id || (direction !== "up" && direction !== "down")) {
    return { ok: false, error: "Invalid reorder request." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("portfolio_projects")
    .select("id, sort_order")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return { ok: false, error: error.message };
  }

  const rows = (data ?? []) as Array<{ id: string; sort_order: number }>;
  const index = rows.findIndex((row) => row.id === id);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapIndex < 0 || swapIndex >= rows.length) {
    return { ok: true };
  }

  const current = rows[index];
  const neighbor = rows[swapIndex];
  const first = await supabase
    .from("portfolio_projects")
    .update({ sort_order: neighbor.sort_order })
    .eq("id", current.id);
  if (first.error) {
    return { ok: false, error: first.error.message };
  }
  const second = await supabase
    .from("portfolio_projects")
    .update({ sort_order: current.sort_order })
    .eq("id", neighbor.id);
  if (second.error) {
    return { ok: false, error: second.error.message };
  }

  revalidatePath("/admin/portfolio");
  return { ok: true };
}

export async function deletePortfolioProject(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = asString(formData.get("projectId"));
  if (!id) {
    return { ok: false, error: "Missing project." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: images, error: imagesError } = await supabase
    .from("portfolio_project_images")
    .select("id, image_url")
    .eq("portfolio_project_id", id);

  if (imagesError) {
    return { ok: false, error: imagesError.message };
  }

  for (const image of (images ?? []) as Array<{ id: string; image_url: string }>) {
    const object = storageObjectPath(image.image_url);
    if (object && object.bucket === PORTFOLIO_IMAGE_BUCKET) {
      await supabase.storage.from(object.bucket).remove([object.path]);
    }
  }

  const { error } = await supabase.from("portfolio_projects").delete().eq("id", id);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/portfolio");
  return { ok: true };
}

export async function addPortfolioImage(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const projectId = asString(formData.get("projectId"));
  const alt = asString(formData.get("alt"));
  const file = formData.get("file");

  if (!projectId) {
    return { ok: false, error: "Missing project." };
  }
  if (!(file instanceof File)) {
    return { ok: false, error: "Choose an image to upload." };
  }
  const fileError = isValidImageFile(file);
  if (fileError) {
    return { ok: false, error: fileError };
  }
  if (alt.length > 200) {
    return { ok: false, error: "Alt text must be 200 characters or fewer." };
  }

  const supabase = await createServerSupabaseClient();
  const storagePath = `${projectId}/${Date.now()}-${safeFileName(file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from(PORTFOLIO_IMAGE_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type || undefined,
      upsert: false,
    });

  if (uploadError) {
    return {
      ok: false,
      error: `Storage upload failed: ${uploadError.message}. Make sure a public "${PORTFOLIO_IMAGE_BUCKET}" bucket exists and allows authenticated uploads.`,
    };
  }

  const { count } = await supabase
    .from("portfolio_project_images")
    .select("id", { count: "exact", head: true })
    .eq("portfolio_project_id", projectId);

  const { error } = await supabase.from("portfolio_project_images").insert({
    portfolio_project_id: projectId,
    image_url: storagePublicUrl(PORTFOLIO_IMAGE_BUCKET, storagePath),
    alt_text: alt || null,
    sort_order: count ?? 0,
  });

  if (error) {
    await supabase.storage.from(PORTFOLIO_IMAGE_BUCKET).remove([storagePath]);
    return { ok: false, error: error.message };
  }

  revalidatePath(`/admin/portfolio/${projectId}`);
  return { ok: true };
}

export async function savePortfolioImageOrder(
  projectId: string,
  rows: Array<{ id: string; altText: string; sortOrder: number }>,
): Promise<ActionResult> {
  await requireAdmin();
  if (!projectId) {
    return { ok: false, error: "Missing project." };
  }
  if (!Array.isArray(rows) || rows.length > 100) {
    return { ok: false, error: "Invalid image list." };
  }

  const supabase = await createServerSupabaseClient();
  for (const row of rows) {
    if (!row.id || row.altText.length > 200 || !Number.isInteger(row.sortOrder) || row.sortOrder < 0) {
      return { ok: false, error: "Invalid image row." };
    }
    const { error } = await supabase
      .from("portfolio_project_images")
      .update({ alt_text: row.altText.trim() || null, sort_order: row.sortOrder })
      .eq("id", row.id);
    if (error) {
      return { ok: false, error: error.message };
    }
  }

  revalidatePath(`/admin/portfolio/${projectId}`);
  return { ok: true };
}

export async function removePortfolioImage(imageId: string): Promise<ActionResult> {
  await requireAdmin();
  if (!imageId) {
    return { ok: false, error: "Missing image." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: image, error: lookupError } = await supabase
    .from("portfolio_project_images")
    .select("portfolio_project_id, image_url")
    .eq("id", imageId)
    .maybeSingle();

  if (lookupError) {
    return { ok: false, error: lookupError.message };
  }
  if (!image) {
    return { ok: false, error: "Image not found." };
  }

  const object = storageObjectPath(image.image_url);
  if (object && object.bucket === PORTFOLIO_IMAGE_BUCKET) {
    await supabase.storage.from(object.bucket).remove([object.path]);
  }

  const { error } = await supabase.from("portfolio_project_images").delete().eq("id", imageId);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/admin/portfolio/${image.portfolio_project_id}`);
  return { ok: true };
}

// ── Services ───────────────────────────────────────────────────────────────

export async function saveService(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const id = asOptionalString(formData.get("id"));
  const name = asString(formData.get("name"));
  const slugRaw = asString(formData.get("slug"));
  const slug = slugRaw ? slugify(slugRaw) : slugify(name);
  const shortDescription = asOptionalString(formData.get("short_description"));
  const description = asOptionalString(formData.get("description"));
  const startingPrice = asOptionalNumber(formData.get("starting_price"));
  const currency = asString(formData.get("currency")) || "BDT";
  const estimatedDaysMin = asOptionalInteger(formData.get("estimated_days_min"));
  const estimatedDaysMax = asOptionalInteger(formData.get("estimated_days_max"));
  const published = asCheckbox(formData.get("published"));
  const featured = asCheckbox(formData.get("featured"));
  const sortOrder = asOptionalInteger(formData.get("sort_order")) ?? 0;

  if (!name) {
    return { ok: false, error: "Service name is required." };
  }
  if (!slug || !isValidSlugFormat(slug)) {
    return {
      ok: false,
      error: "Slug is required and must be lowercase letters, numbers and hyphens (e.g. web-design).",
    };
  }
  if (startingPrice != null && startingPrice < 0) {
    return { ok: false, error: "Starting price cannot be negative." };
  }
  if (estimatedDaysMin != null && estimatedDaysMin < 0) {
    return { ok: false, error: "Estimated days cannot be negative." };
  }
  if (
    estimatedDaysMin != null &&
    estimatedDaysMax != null &&
    estimatedDaysMax < estimatedDaysMin
  ) {
    return { ok: false, error: "Max estimated days cannot be less than min." };
  }
  if (currency.length > 8) {
    return { ok: false, error: "Currency code is too long." };
  }

  const uniqueError = await assertUniqueSlug("services", slug, id);
  if (uniqueError) {
    return { ok: false, error: uniqueError };
  }

  const payload = {
    name,
    slug,
    short_description: shortDescription,
    description,
    starting_price: startingPrice,
    currency,
    estimated_days_min: estimatedDaysMin,
    estimated_days_max: estimatedDaysMax,
    published,
    featured,
    sort_order: sortOrder,
  };

  const supabase = await createServerSupabaseClient();
  const { data: saved, error } = id
    ? await supabase.from("services").update(payload).eq("id", id).select("id").maybeSingle()
    : await supabase.from("services").insert(payload).select("id").maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!saved) {
    return { ok: false, error: "Service not found." };
  }

  revalidatePath("/admin/services");
  revalidatePath(`/admin/services/${saved.id}`);
  revalidatePath("/");
  revalidatePath("/services");
  if (!id) {
    redirect(`/admin/services/${saved.id}`);
  }
  return { ok: true };
}

export async function setServiceFlag(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = asString(formData.get("serviceId"));
  const flag = asString(formData.get("flag"));
  const valueRaw = asString(formData.get("value"));

  if (!id) {
    return { ok: false, error: "Missing service." };
  }
  if (flag !== "featured" && flag !== "published") {
    return { ok: false, error: "Invalid flag." };
  }
  if (valueRaw !== "true" && valueRaw !== "false") {
    return { ok: false, error: "Invalid flag value." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("services")
    .update(flag === "featured" ? { featured: valueRaw === "true" } : { published: valueRaw === "true" })
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/services");
  revalidatePath(`/admin/services/${id}`);
  revalidatePath("/");
  revalidatePath("/services");
  return { ok: true };
}

export async function reorderService(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = asString(formData.get("serviceId"));
  const direction = asString(formData.get("direction"));

  if (!id || (direction !== "up" && direction !== "down")) {
    return { ok: false, error: "Invalid reorder request." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("services")
    .select("id, sort_order")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return { ok: false, error: error.message };
  }

  const rows = (data ?? []) as Array<{ id: string; sort_order: number }>;
  const index = rows.findIndex((row) => row.id === id);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapIndex < 0 || swapIndex >= rows.length) {
    return { ok: true };
  }

  const current = rows[index];
  const neighbor = rows[swapIndex];
  const first = await supabase.from("services").update({ sort_order: neighbor.sort_order }).eq("id", current.id);
  if (first.error) {
    return { ok: false, error: first.error.message };
  }
  const second = await supabase.from("services").update({ sort_order: current.sort_order }).eq("id", neighbor.id);
  if (second.error) {
    return { ok: false, error: second.error.message };
  }

  revalidatePath("/admin/services");
  revalidatePath("/");
  revalidatePath("/services");
  return { ok: true };
}

export async function deleteService(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = asString(formData.get("serviceId"));
  if (!id) {
    return { ok: false, error: "Missing service." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/services");
  revalidatePath("/");
  revalidatePath("/services");
  return { ok: true };
}

export async function saveServiceFeatures(
  serviceId: string,
  features: Array<{ id: string | null; feature: string }>,
): Promise<ActionResult> {
  await requireAdmin();
  if (!serviceId) {
    return { ok: false, error: "Missing service." };
  }
  if (!Array.isArray(features) || features.length > 50) {
    return { ok: false, error: "Invalid feature list." };
  }

  const cleaned = features
    .map((item) => ({ feature: item.feature.trim(), id: item.id }))
    .filter((item) => item.feature.length > 0);

  for (const item of cleaned) {
    if (item.feature.length > 500) {
      return { ok: false, error: "Each feature must be 500 characters or fewer." };
    }
  }

  const supabase = await createServerSupabaseClient();
  const { error: deleteError } = await supabase
    .from("service_features")
    .delete()
    .eq("service_id", serviceId);
  if (deleteError) {
    return { ok: false, error: deleteError.message };
  }

  if (cleaned.length > 0) {
    const { error: insertError } = await supabase.from("service_features").insert(
      cleaned.map((item, index) => ({
        service_id: serviceId,
        feature: item.feature,
        sort_order: index,
      })),
    );
    if (insertError) {
      return { ok: false, error: insertError.message };
    }
  }

  revalidatePath("/admin/services");
  revalidatePath(`/admin/services/${serviceId}`);
  revalidatePath("/");
  revalidatePath("/services");
  return { ok: true };
}
