import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  isReviewStatus,
  type AdminReviewItem,
  type QueryResult,
  type ReviewFilters,
} from "@/lib/admin-review-constants";
import type { ProfileRow, ReviewRow } from "@/types/database";

export * from "@/lib/admin-review-constants";

function isMissingRelation(error: { message?: string; code?: string } | null): boolean {
  if (!error) {
    return false;
  }

  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.code === "PGRST200" ||
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find the table") ||
    message.includes("could not find a relationship")
  );
}

function toQueryResult<T>(
  data: T,
  error: { message?: string; code?: string } | null,
  table: string,
  isEmpty: boolean,
): QueryResult<T> {
  if (error) {
    if (isMissingRelation(error)) {
      return {
        status: "unavailable",
        message: `${table} is not available in the current database schema.`,
      };
    }
    return { status: "error", message: error.message ?? "Unknown error" };
  }

  return isEmpty ? { status: "empty", data } : { status: "ok", data };
}

/** Reviews for the moderation inbox, newest submissions first, optional status filter. */
export async function getAdminReviews(
  filters: ReviewFilters,
): Promise<QueryResult<AdminReviewItem[]>> {
  const supabase = await createServerSupabaseClient();
  const status = filters.status && isReviewStatus(filters.status) ? filters.status : null;

  let query = supabase
    .from("reviews")
    .select("*")
    .order("submitted_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  const rows = (data ?? []) as ReviewRow[];
  if (error) {
    return toQueryResult<AdminReviewItem[]>([], error, "reviews", true);
  }

  if (rows.length === 0) {
    return { status: "empty", data: [] };
  }

  const clientIds = [...new Set(rows.map((row) => row.client_id))];
  const projectIds = [...new Set(rows.map((row) => row.project_id))];

  const clientNames = new Map<string, { name: string; company: string | null }>();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, display_name, company_name")
    .in("id", clientIds);
  for (const profile of (profiles ?? []) as Pick<
    ProfileRow,
    "id" | "full_name" | "display_name" | "company_name"
  >[]) {
    clientNames.set(profile.id, {
      name: profile.display_name?.trim() || profile.full_name.trim() || "Unknown client",
      company: profile.company_name,
    });
  }

  const projectRefs = new Map<string, { project_number: string; title: string }>();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, project_number, title")
    .in("id", projectIds);
  for (const project of (projects ?? []) as Array<{
    id: string;
    project_number: string;
    title: string;
  }>) {
    projectRefs.set(project.id, {
      project_number: project.project_number,
      title: project.title,
    });
  }

  const items: AdminReviewItem[] = rows.map((row) => {
    const client = clientNames.get(row.client_id);
    const project = projectRefs.get(row.project_id);
    return {
      ...row,
      clientName: client?.name ?? "Unknown client",
      clientCompany: client?.company ?? null,
      projectNumber: project?.project_number ?? "—",
      projectTitle: project?.title ?? "",
    };
  });

  return { status: "ok", data: items };
}
