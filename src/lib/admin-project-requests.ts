import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  isRequestStatus,
  type AdminProjectRequestDetail,
  type AdminProjectRequestListItem,
  type LinkedProjectSummary,
  type ProjectClient,
  type ProjectRequestListFilters,
  type QueryResult,
  type RequestReferralCode,
} from "@/lib/admin-project-request-constants";
import type { ProjectRequestRow, ProjectRow, RequestStatus, ServiceRow } from "@/types/database";

export * from "@/lib/admin-project-request-constants";

const REQUEST_COLUMNS =
  "id, request_number, client_id, full_name, email, phone, company_name, project_type, website_status, page_count, description, required_features, has_design, figma_url, reference_urls, design_style, has_logo, has_brand_colors, brand_colors, budget_min, budget_max, budget_currency, deadline_type, deadline_date, referral_code_entered, referral_code_id, source, status, service_id, form_snapshot, submitted_at, updated_at";

/**
 * Statuses a request list filter applies. Filtering by "approved" also returns
 * requests the database marked `converted` after the client accepted a quote —
 * the product treats both as an approved request (a project exists for the
 * converted ones).
 */
function statusesForFilter(status: RequestStatus | null): RequestStatus[] | null {
  if (!status) {
    return null;
  }
  return status === "approved" ? ["approved", "converted"] : [status];
}

function isMissingRelation(error: { message?: string; code?: string } | null): boolean {
  if (!error) {
    return false;
  }

  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.code === "PGRST200" ||
    error.code === "PGRST202" ||
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find the table") ||
    message.includes("could not find a relationship") ||
    message.includes("could not find the function")
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

function escapeSearch(value: string): string {
  return value.replace(/[%_,()]/g, " ").trim();
}

export async function getAdminProjectRequests(
  filters: ProjectRequestListFilters,
): Promise<QueryResult<AdminProjectRequestListItem[]>> {
  const supabase = await createServerSupabaseClient();
  const search = escapeSearch(filters.q ?? "");
  const status = filters.status && isRequestStatus(filters.status) ? filters.status : null;
  const ascending = filters.dir === "asc";

  let query = supabase
    .from("project_requests")
    .select(REQUEST_COLUMNS)
    .order("submitted_at", { ascending, nullsFirst: false });

  const statuses = statusesForFilter(status);
  if (statuses) {
    query = query.in("status", statuses);
  }

  if (search) {
    query = query.or(
      [
        `request_number.ilike.%${search}%`,
        `full_name.ilike.%${search}%`,
        `email.ilike.%${search}%`,
        `project_type.ilike.%${search}%`,
      ].join(","),
    );
  }

  const { data, error } = await query;
  const rows = (data ?? []) as ProjectRequestRow[];
  if (error) {
    return toQueryResult([], error, "project_requests", true);
  }

  // Attach the actual project (if any) to every request so admin lists can
  // surface the linked PJ number next to the PR number.
  const requestIds = rows.map((row) => row.id);
  const linkedByRequestId = new Map<string, LinkedProjectSummary>();
  if (requestIds.length > 0) {
    const { data: projectRows } = await supabase
      .from("projects")
      .select("id, request_id, project_number, title, status")
      .in("request_id", requestIds)
      .order("created_at", { ascending: true });

    for (const project of (projectRows ?? []) as Array<
      Pick<ProjectRow, "id" | "request_id" | "project_number" | "title" | "status">
    >) {
      if (project.request_id && !linkedByRequestId.has(project.request_id)) {
        linkedByRequestId.set(project.request_id, {
          id: project.id,
          project_number: project.project_number,
          title: project.title,
          status: project.status,
        });
      }
    }
  }

  const items: AdminProjectRequestListItem[] = rows.map((row) => ({
    ...row,
    linkedProject: linkedByRequestId.get(row.id) ?? null,
  }));

  return toQueryResult(items, null, "project_requests", items.length === 0);
}

export async function getAdminProjectRequest(
  id: string,
): Promise<QueryResult<AdminProjectRequestDetail>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("project_requests")
    .select(REQUEST_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return toQueryResult(
      null as unknown as AdminProjectRequestDetail,
      error,
      "project_requests",
      true,
    );
  }

  if (!data) {
    return {
      status: "empty",
      data: null as unknown as AdminProjectRequestDetail,
    };
  }

  const request = data as ProjectRequestRow;
  let client: ProjectClient | null = null;
  let serviceName: string | null = null;
  let referralCode: RequestReferralCode | null = null;
  let linkedProject: LinkedProjectSummary | null = null;

  if (request.client_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, display_name, company_name, avatar_url")
      .eq("id", request.client_id)
      .maybeSingle();
    client = profile ?? null;
  }

  if (request.service_id) {
    const { data: service } = await supabase
      .from("services")
      .select("id, name")
      .eq("id", request.service_id)
      .maybeSingle();
    serviceName = (service as Pick<ServiceRow, "id" | "name"> | null)?.name ?? null;
  }

  if (request.referral_code_id) {
    const { data: code } = await supabase
      .from("referral_codes")
      .select("id, code, is_active")
      .eq("id", request.referral_code_id)
      .maybeSingle();
    referralCode = (code as RequestReferralCode | null) ?? null;
  }

  const { data: projectRows } = await supabase
    .from("projects")
    .select("id, project_number, title, status, created_at")
    .eq("request_id", request.id)
    .order("created_at", { ascending: true })
    .limit(1);

  linkedProject = (projectRows?.[0] as LinkedProjectSummary | undefined) ?? null;

  return {
    status: "ok",
    data: {
      ...request,
      client,
      serviceName,
      referralCode,
      linkedProject,
    },
  };
}
