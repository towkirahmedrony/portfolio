"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { isValidHttpUrl } from "@/lib/admin-content-constants";
import {
  applyModerationAction,
  isReviewModerationAction,
  type ReviewModerationAction,
} from "@/lib/admin-review-constants";
import { removeStorageObject } from "@/lib/photo-storage";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { ok: false; error: string };

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Moderate a review (approve / reject / hide / unhide / publish). Ownership
 * columns (client_id, project_id) are never touched — only status and
 * published_at, through the centralized moderation state machine.
 */
export async function moderateReview(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const reviewId = asString(formData.get("reviewId"));
  const actionRaw = asString(formData.get("action"));

  if (!reviewId) {
    return { ok: false, error: "Missing review." };
  }
  if (!isReviewModerationAction(actionRaw)) {
    return { ok: false, error: "Invalid moderation action." };
  }
  const action = actionRaw as ReviewModerationAction;

  const supabase = await createServerSupabaseClient();
  const { data: review, error } = await supabase
    .from("reviews")
    .select("id, status, published_at")
    .eq("id", reviewId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!review) {
    return { ok: false, error: "Review not found." };
  }

  const outcome = applyModerationAction(review, action);
  if (!outcome.ok) {
    return { ok: false, error: outcome.reason };
  }

  const { error: updateError } = await supabase
    .from("reviews")
    .update(outcome.updates)
    .eq("id", reviewId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  revalidatePath("/admin/reviews");
  return { ok: true };
}

export async function saveReviewPhoto(
  reviewId: string,
  photoUrl: string | null,
): Promise<ActionResult> {
  await requireAdmin();
  if (!reviewId) {
    return { ok: false, error: "Missing review." };
  }
  if (photoUrl && !isValidHttpUrl(photoUrl)) {
    return { ok: false, error: "Review photo must be a valid http(s) URL." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: review, error } = await supabase
    .from("reviews")
    .select("id, photo_url")
    .eq("id", reviewId)
    .maybeSingle();
  if (error) {
    return { ok: false, error: error.message };
  }
  if (!review) {
    return { ok: false, error: "Review not found." };
  }

  const previous = (review as { photo_url?: string | null }).photo_url ?? null;
  const { error: updateError } = await supabase
    .from("reviews")
    .update({ photo_url: photoUrl })
    .eq("id", reviewId);
  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  if (previous && previous !== photoUrl) {
    await removeStorageObject(previous);
  }

  revalidatePath("/admin/reviews");
  return { ok: true };
}
