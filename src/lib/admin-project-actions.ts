"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  isFileCategory,
  isMilestoneStatus,
  isProjectPriority,
  isProjectStatus,
  PROJECT_FILE_BUCKET,
} from "@/lib/admin-project-constants";
import { buildPhotoObjectPath, isValidImageFile, PHOTOS_BUCKET } from "@/lib/photos";
import type { FileCategory, MilestoneStatus, ProjectPriority, ProjectStatus } from "@/types/database";

type ActionResult = { ok: true } | { ok: false; error: string };

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalString(value: FormDataEntryValue | null): string | null {
  const next = asString(value);
  return next ? next : null;
}

function asOptionalNumber(value: FormDataEntryValue | null): number | null {
  const next = asString(value);
  if (!next) {
    return null;
  }
  const parsed = Number(next);
  return Number.isFinite(parsed) ? parsed : null;
}

function asOptionalInteger(value: FormDataEntryValue | null): number | null {
  const parsed = asOptionalNumber(value);
  return parsed == null ? null : Math.trunc(parsed);
}

function parseStringList(value: string): string[] {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function revalidateProject(projectId: string) {
  revalidatePath("/admin/projects");
  revalidatePath(`/admin/projects/${projectId}`);
}

export async function updateProjectOverview(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const projectId = asString(formData.get("projectId"));
  const title = asString(formData.get("title"));
  const description = asOptionalString(formData.get("description"));
  const statusRaw = asString(formData.get("status"));
  const priorityRaw = asString(formData.get("priority"));
  const estimatedBudget = asOptionalNumber(formData.get("estimated_budget"));
  const agreedPrice = asOptionalNumber(formData.get("agreed_price"));
  const startDate = asOptionalString(formData.get("start_date"));
  const dueDate = asOptionalString(formData.get("due_date"));

  if (!projectId) {
    return { ok: false, error: "Missing project." };
  }
  if (!title) {
    return { ok: false, error: "Title is required." };
  }
  if (!isProjectStatus(statusRaw)) {
    return { ok: false, error: "Invalid project status." };
  }
  if (!isProjectPriority(priorityRaw)) {
    return { ok: false, error: "Invalid project priority." };
  }

  const status = statusRaw as ProjectStatus;
  const priority = priorityRaw as ProjectPriority;
  const supabase = await createServerSupabaseClient();
  const completedAt = status === "completed" ? new Date().toISOString() : null;
  const cancelledAt = status === "cancelled" ? new Date().toISOString() : null;

  const { error } = await supabase
    .from("projects")
    .update({
      title,
      description,
      status,
      priority,
      estimated_budget: estimatedBudget,
      agreed_price: agreedPrice,
      start_date: startDate,
      due_date: dueDate,
      completed_at: completedAt,
      cancelled_at: cancelledAt,
    })
    .eq("id", projectId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateProject(projectId);
  return { ok: true };
}

export async function upsertProjectRequirements(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const projectId = asString(formData.get("projectId"));
  const requirementId = asOptionalString(formData.get("requirementId"));

  if (!projectId) {
    return { ok: false, error: "Missing project." };
  }

  const payload = {
    project_id: projectId,
    summary: asOptionalString(formData.get("summary")),
    scope: asOptionalString(formData.get("scope")),
    pages: asOptionalInteger(formData.get("pages")),
    features: parseStringList(asString(formData.get("features"))),
    design_notes: asOptionalString(formData.get("design_notes")),
    technical_notes: asOptionalString(formData.get("technical_notes")),
    content_notes: asOptionalString(formData.get("content_notes")),
    third_party_services: parseStringList(asString(formData.get("third_party_services"))),
    constraints: asOptionalString(formData.get("constraints")),
  };

  const supabase = await createServerSupabaseClient();
  const { error } = requirementId
    ? await supabase.from("project_requirements").update(payload).eq("id", requirementId)
    : await supabase.from("project_requirements").insert(payload);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateProject(projectId);
  return { ok: true };
}

export async function createProjectMilestone(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const projectId = asString(formData.get("projectId"));
  const title = asString(formData.get("title"));
  const description = asOptionalString(formData.get("description"));
  const dueDate = asOptionalString(formData.get("due_date"));
  const statusRaw = asString(formData.get("status")) || "pending";

  if (!projectId) {
    return { ok: false, error: "Missing project." };
  }
  if (!title) {
    return { ok: false, error: "Milestone title is required." };
  }
  if (!isMilestoneStatus(statusRaw)) {
    return { ok: false, error: "Invalid milestone status." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: existing } = await supabase
    .from("project_milestones")
    .select("sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder =
    existing && existing.length > 0 ? Number(existing[0].sort_order ?? 0) + 1 : 0;
  const status = statusRaw as MilestoneStatus;

  const { error } = await supabase.from("project_milestones").insert({
    project_id: projectId,
    title,
    description,
    due_date: dueDate,
    status,
    sort_order: nextOrder,
    completed_at: status === "completed" ? new Date().toISOString() : null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateProject(projectId);
  return { ok: true };
}

export async function updateProjectMilestone(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const projectId = asString(formData.get("projectId"));
  const milestoneId = asString(formData.get("milestoneId"));
  const title = asString(formData.get("title"));
  const description = asOptionalString(formData.get("description"));
  const dueDate = asOptionalString(formData.get("due_date"));
  const statusRaw = asString(formData.get("status"));

  if (!projectId || !milestoneId) {
    return { ok: false, error: "Missing milestone." };
  }
  if (!title) {
    return { ok: false, error: "Milestone title is required." };
  }
  if (!isMilestoneStatus(statusRaw)) {
    return { ok: false, error: "Invalid milestone status." };
  }

  const status = statusRaw as MilestoneStatus;
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("project_milestones")
    .update({
      title,
      description,
      due_date: dueDate,
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", milestoneId)
    .eq("project_id", projectId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateProject(projectId);
  return { ok: true };
}

export async function reorderProjectMilestone(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const projectId = asString(formData.get("projectId"));
  const milestoneId = asString(formData.get("milestoneId"));
  const direction = asString(formData.get("direction"));

  if (!projectId || !milestoneId) {
    return { ok: false, error: "Missing milestone." };
  }
  if (direction !== "up" && direction !== "down") {
    return { ok: false, error: "Invalid reorder direction." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: milestones, error } = await supabase
    .from("project_milestones")
    .select("id, sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return { ok: false, error: error.message };
  }

  const rows = milestones ?? [];
  const index = rows.findIndex((row) => row.id === milestoneId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;

  if (index < 0 || swapIndex < 0 || swapIndex >= rows.length) {
    return { ok: true };
  }

  const current = rows[index];
  const neighbor = rows[swapIndex];

  const first = await supabase
    .from("project_milestones")
    .update({ sort_order: neighbor.sort_order })
    .eq("id", current.id);
  if (first.error) {
    return { ok: false, error: first.error.message };
  }

  const second = await supabase
    .from("project_milestones")
    .update({ sort_order: current.sort_order })
    .eq("id", neighbor.id);
  if (second.error) {
    return { ok: false, error: second.error.message };
  }

  revalidateProject(projectId);
  return { ok: true };
}

export async function createProjectNote(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const projectId = asString(formData.get("projectId"));
  const note = asString(formData.get("note"));
  const visibility = asString(formData.get("visibility")) || "internal";

  if (!projectId) {
    return { ok: false, error: "Missing project." };
  }
  if (!note) {
    return { ok: false, error: "Note cannot be empty." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("project_notes").insert({
    project_id: projectId,
    author_id: admin.id,
    note,
    is_internal: visibility !== "client",
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateProject(projectId);
  return { ok: true };
}

export async function updateProjectNote(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const projectId = asString(formData.get("projectId"));
  const noteId = asString(formData.get("noteId"));
  const note = asString(formData.get("note"));
  const visibility = asString(formData.get("visibility")) || "internal";

  if (!projectId || !noteId) {
    return { ok: false, error: "Missing note." };
  }
  if (!note) {
    return { ok: false, error: "Note cannot be empty." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("project_notes")
    .update({
      note,
      is_internal: visibility !== "client",
    })
    .eq("id", noteId)
    .eq("project_id", projectId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateProject(projectId);
  return { ok: true };
}

export async function sendProjectMessage(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const projectId = asString(formData.get("projectId"));
  const message = asString(formData.get("message"));
  const replyToId = asOptionalString(formData.get("replyToId"));

  if (!projectId) {
    return { ok: false, error: "Missing project." };
  }
  if (!message) {
    return { ok: false, error: "Message cannot be empty." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("project_messages").insert({
    project_id: projectId,
    sender_id: admin.id,
    message,
    reply_to_id: replyToId,
    is_read: false,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateProject(projectId);
  return { ok: true };
}

export async function uploadProjectFile(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const projectId = asString(formData.get("projectId"));
  const file = formData.get("file");
  const categoryRaw = asString(formData.get("category")) || "other";
  const visibility = asString(formData.get("visibility")) || "internal";

  if (!projectId) {
    return { ok: false, error: "Missing project." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a file to upload." };
  }
  if (!isFileCategory(categoryRaw)) {
    return { ok: false, error: "Invalid file category." };
  }

  const category = categoryRaw as FileCategory;
  const isImage = file.type.startsWith("image/") && isValidImageFile(file) == null;
  const bucketName = isImage ? PHOTOS_BUCKET : PROJECT_FILE_BUCKET;
  const storagePath = isImage
    ? buildPhotoObjectPath("projects", file.name, projectId)
    : `${projectId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
  const supabase = await createServerSupabaseClient();

  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(storagePath, file, {
      contentType: file.type || undefined,
      upsert: false,
    });

  if (uploadError) {
    return {
      ok: false,
      error: `Storage upload failed: ${uploadError.message}. Confirm the "${bucketName}" bucket exists.`,
    };
  }

  const { error } = await supabase.from("project_files").insert({
    project_id: projectId,
    uploaded_by: admin.id,
    bucket_name: bucketName,
    storage_path: storagePath,
    original_name: file.name,
    mime_type: file.type || null,
    file_size_bytes: file.size,
    category,
    is_public: visibility === "public",
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateProject(projectId);
  return { ok: true };
}

export async function deleteProjectFile(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const projectId = asString(formData.get("projectId"));
  const fileId = asString(formData.get("fileId"));

  if (!projectId || !fileId) {
    return { ok: false, error: "Missing file." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: file, error: lookupError } = await supabase
    .from("project_files")
    .select("id, bucket_name, storage_path")
    .eq("id", fileId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (lookupError) {
    return { ok: false, error: lookupError.message };
  }
  if (!file) {
    return { ok: false, error: "File not found." };
  }

  await supabase.storage.from(file.bucket_name).remove([file.storage_path]);

  const { error } = await supabase
    .from("project_files")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", fileId)
    .eq("project_id", projectId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateProject(projectId);
  return { ok: true };
}
