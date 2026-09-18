import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getAdminClientDetails,
  toProjectClient,
} from "@/lib/admin-client-details-server";
import {
  PROJECT_REQUEST_LIST_PAGE_SIZE,
  isRequestStatus,
  type AdminProjectRequestDetail,
  type AdminProjectRequestListData,
  type AdminProjectRequestListItem,
  type LinkedProjectSummary,
  type ProjectClient,
  type ProjectRequestListFilters,
  type QueryResult,
  type RequestReferralCode,
} from "@/lib/admin-project-request-constants";
import type { ProjectRequestRow, ProjectRow, ServiceRow } from "@/types/database";

export * from "@/lib/admin-project-request-constants";

const REQUEST_COLUMNS =
  "id, request_number, client_id, full_name, email, backup_email, phone, company_name, project_type, website_status, page_count, description, required_features, has_design, figma_url, reference_urls, design_style, has_logo, has_brand_colors, brand_colors, budget_min, budget_max, budget_currency, deadline_type, deadline_date, referral_code_entered, referral_code_id, source, status, service_id, form_snapshot, submitted_at, updated_at";

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

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

const EMPTY_REQUEST_LIST: AdminProjectRequestListData = {
  items: [],
  total: 0,
  page: 1,
  pageSize: PROJECT_REQUEST_LIST_PAGE_SIZE,
  totalPages: 1,
};

export async function getAdminProjectRequests(
  filters: ProjectRequestListFilters,
): Promise<QueryResult<AdminProjectRequestListData>> {
  const supabase = await createServerSupabaseClient();
  const search = escapeSearch(filters.q ?? "");
  const status = filters.status && isRequestStatus(filters.status) ? filters.status : null;
  const ascending = filters.dir === "asc";
  const requestedPage = Math.max(1, Number.parseInt(filters.page ?? "1", 10) || 1);

  let searchOr: string | null = null;

  if (search) {
    const [matchedClients, matchedProjects] = await Promise.all([
      supabase
        .from("profiles")
        .select("id")
        .or(
          [
            `full_name.ilike.%${search}%`,
            `display_name.ilike.%${search}%`,
            `company_name.ilike.%${search}%`,
            `phone.ilike.%${search}%`,
            `backup_email.ilike.%${search}%`,
          ].join(","),
        ),
      supabase
        .from("projects")
        .select("id, request_id")
        .or(
          [
            `project_number.ilike.%${search}%`,
            `title.ilike.%${search}%`,
            ...(isUuid(search) ? [`id.eq.${search}`] : []),
          ].join(","),
        ),
    ]);

    const clientIds = (matchedClients.data ?? []).map((row) => row.id);
    const linkedRequestIds = (matchedProjects.data ?? [])
      .map((row) => row.request_id)
      .filter((id): id is string => Boolean(id));

    const searchFilter = [
      `request_number.ilike.%${search}%`,
      `full_name.ilike.%${search}%`,
      `email.ilike.%${search}%`,
      `backup_email.ilike.%${search}%`,
      `phone.ilike.%${search}%`,
      `company_name.ilike.%${search}%`,
      `project_type.ilike.%${search}%`,
      `description.ilike.%${search}%`,
    ];

    if (isUuid(search)) {
      searchFilter.push(`id.eq.${search}`);
    }
    if (clientIds.length > 0) {
      searchFilter.push(`client_id.in.(${clientIds.join(",")})`);
    }
    if (linkedRequestIds.length > 0) {
      searchFilter.push(`id.in.(${linkedRequestIds.join(",")})`);
    }

    searchOr = searchFilter.join(",");
  }

  let query = supabase
    .from("project_requests")
    .select(REQUEST_COLUMNS, { count: "exact" })
    .order("submitted_at", { ascending, nullsFirst: false });

  if (status) {
    query = query.eq("status", status);
  }
  if (searchOr) {
    query = query.or(searchOr);
  }

  const from = (requestedPage - 1) * PROJECT_REQUEST_LIST_PAGE_SIZE;
  const to = from + PROJECT_REQUEST_LIST_PAGE_SIZE - 1;
  const { data, error, count } = await query.range(from, to);

  if (error) {
    return toQueryResult(EMPTY_REQUEST_LIST, error, "project_requests", true);
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PROJECT_REQUEST_LIST_PAGE_SIZE));
  let page = Math.min(requestedPage, totalPages);
  let rows = (data ?? []) as ProjectRequestRow[];

  if (requestedPage > totalPages && total > 0) {
    const clampedFrom = (totalPages - 1) * PROJECT_REQUEST_LIST_PAGE_SIZE;
    const clampedTo = clampedFrom + PROJECT_REQUEST_LIST_PAGE_SIZE - 1;
    let clampedQuery = supabase
      .from("project_requests")
      .select(REQUEST_COLUMNS)
      .order("submitted_at", { ascending, nullsFirst: false });
    if (status) {
      clampedQuery = clampedQuery.eq("status", status);
    }
    if (searchOr) {
      clampedQuery = clampedQuery.or(searchOr);
    }
    const { data: clampedData, error: clampedError } = await clampedQuery.range(
      clampedFrom,
      clampedTo,
    );
    if (clampedError) {
      return toQueryResult(EMPTY_REQUEST_LIST, clampedError, "project_requests", true);
    }
    rows = (clampedData ?? []) as ProjectRequestRow[];
    page = totalPages;
  }

  const uniqueClientIds = [
    ...new Set(rows.map((row) => row.client_id).filter((id): id is string => Boolean(id))),
  ];
  const requestIds = rows.map((row) => row.id);
  const clients = new Map<string, ProjectClient>();
  const linkedProjects = new Map<string, LinkedProjectSummary>();

  const [profilesResult, projectsResult] = await Promise.all([
    uniqueClientIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, full_name, display_name, company_name, avatar_url")
          .in("id", uniqueClientIds)
      : Promise.resolve({ data: [] as ProjectClient[] }),
    requestIds.length > 0
      ? supabase
          .from("projects")
          .select("id, project_number, title, status, request_id, created_at")
          .in("request_id", requestIds)
      : Promise.resolve({ data: [] as (Pick<ProjectRow, "id" | "project_number" | "title" | "status" | "request_id" | "created_at">)[] }),
  ]);

  for (const profile of profilesResult.data ?? []) {
    clients.set(profile.id, profile);
  }

  const projectRows = (projectsResult.data ?? []) as (LinkedProjectSummary & {
    request_id: string | null;
    created_at: string;
  })[];
  projectRows.sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const project of projectRows) {
    if (project.request_id && !linkedProjects.has(project.request_id)) {
      linkedProjects.set(project.request_id, {
        id: project.id,
        project_number: project.project_number,
        title: project.title,
        status: project.status,
      });
    }
  }

  const items: AdminProjectRequestListItem[] = rows.map((row) => ({
    ...row,
    client: row.client_id ? clients.get(row.client_id) ?? null : null,
    linkedProject: linkedProjects.get(row.id) ?? null,
  }));

  return {
    status: items.length === 0 && total === 0 ? "empty" : "ok",
    data: {
      items,
      total,
      page,
      pageSize: PROJECT_REQUEST_LIST_PAGE_SIZE,
      totalPages,
    },
  };
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

  // The client, service, referral-code and linked-project lookups are
  // independent of each other — run them concurrently instead of in series.
  //
  // A request reaches its client through `project_requests.client_id ->
  // profiles.id` (FK `project_requests_client_id_fkey`), which is NOT the same
  // path the project page uses. client_id is nullable: anonymous
  // /start-project submissions leave it null, and `getAdminClientDetails`
  // reports that as `hasAccount: false` instead of throwing. It also loads the
  // trusted auth.users email through the admin-gated RPC.
  const clientDetailsPromise = getAdminClientDetails(request.client_id);

  const servicePromise = request.service_id
    ? supabase
        .from("services")
        .select("id, name")
        .eq("id", request.service_id)
        .maybeSingle()
        .then(
          ({ data: service }) =>
            (service as Pick<ServiceRow, "id" | "name"> | null)?.name ?? null,
        )
    : Promise.resolve(null);

  const referralPromise = request.referral_code_id
    ? supabase
        .from("referral_codes")
        .select("id, code, is_active")
        .eq("id", request.referral_code_id)
        .maybeSingle()
        .then(({ data: code }) => (code as RequestReferralCode | null) ?? null)
    : Promise.resolve(null);

  const linkedProjectPromise = supabase
    .from("projects")
    .select("id, project_number, title, status, created_at")
    .eq("request_id", request.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .then(
      ({ data: projectRows }) =>
        (projectRows?.[0] as LinkedProjectSummary | undefined) ?? null,
    );

  const [clientDetails, serviceName, referralCode, linkedProject] =
    await Promise.all([
      clientDetailsPromise,
      servicePromise,
      referralPromise,
      linkedProjectPromise,
    ]);

  return {
    status: "ok",
    data: {
      ...request,
      client: toProjectClient(clientDetails),
      clientDetails,
      serviceName,
      referralCode,
      linkedProject,
    },
  };
}
