import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/admin-dashboard";
import {
  getAdminClientDetails,
  toProjectClient,
} from "@/lib/admin-client-details-server";
import {
  PROJECT_LIST_PAGE_SIZE,
  isProjectPriority,
  isProjectSortField,
  isProjectStatus,
  type AdminProjectDetail,
  type AdminProjectListData,
  type AdminProjectListItem,
  type ProjectClient,
  type ProjectListFilters,
  type QueryResult,
} from "@/lib/admin-project-constants";
import type {
  InvoiceRow,
  PaymentRow,
  ProjectDiscountRow,
  ProjectFileRow,
  ProjectMilestoneRow,
  ProjectMessageRow,
  ProjectNoteRow,
  ProjectRequirementRow,
  ProjectRow,
  ProjectStatusHistoryRow,
  QuoteRow,
} from "@/types/database";

export * from "@/lib/admin-project-constants";

export function formatProjectBudget(
  project: Pick<ProjectRow, "agreed_price" | "estimated_budget" | "currency">,
): string {
  const amount = project.agreed_price ?? project.estimated_budget;
  if (amount == null) {
    return "Not set";
  }
  return formatMoney(Number(amount), project.currency || "BDT");
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

const PROJECT_LIST_COLUMNS =
  "id, project_number, request_id, client_id, title, description, status, priority, currency, estimated_budget, agreed_price, start_date, due_date, completed_at, cancelled_at, created_at, updated_at";

function escapeSearch(value: string): string {
  return value.replace(/[%_,()]/g, " ").trim();
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

const EMPTY_PROJECT_LIST: AdminProjectListData = {
  items: [],
  total: 0,
  page: 1,
  pageSize: PROJECT_LIST_PAGE_SIZE,
  totalPages: 1,
};

export async function getAdminProjects(
  filters: ProjectListFilters,
): Promise<QueryResult<AdminProjectListData>> {
  const supabase = await createServerSupabaseClient();
  const escapedSearch = escapeSearch(filters.q ?? "");
  const status = filters.status && isProjectStatus(filters.status) ? filters.status : null;
  const priority =
    filters.priority && isProjectPriority(filters.priority) ? filters.priority : null;
  const sort = filters.sort && isProjectSortField(filters.sort) ? filters.sort : "created_at";
  const ascending = filters.dir === "asc";
  const isKanban = filters.view === "kanban";
  const requestedPage = Math.max(1, Number.parseInt(filters.page ?? "1", 10) || 1);

  let searchOr: string | null = null;

  if (escapedSearch) {
    const [matchedClients, matchedRequests] = await Promise.all([
      supabase
        .from("profiles")
        .select("id")
        .or(
          [
            `full_name.ilike.%${escapedSearch}%`,
            `display_name.ilike.%${escapedSearch}%`,
            `company_name.ilike.%${escapedSearch}%`,
            `phone.ilike.%${escapedSearch}%`,
            `backup_email.ilike.%${escapedSearch}%`,
          ].join(","),
        ),
      supabase
        .from("project_requests")
        .select("id, client_id")
        .or(
          [
            `request_number.ilike.%${escapedSearch}%`,
            `full_name.ilike.%${escapedSearch}%`,
            `email.ilike.%${escapedSearch}%`,
            `backup_email.ilike.%${escapedSearch}%`,
            `phone.ilike.%${escapedSearch}%`,
            `company_name.ilike.%${escapedSearch}%`,
          ].join(","),
        ),
    ]);

    const clientIds = [
      ...new Set([
        ...(matchedClients.data ?? []).map((row) => row.id),
        ...(matchedRequests.data ?? [])
          .map((row) => row.client_id)
          .filter((id): id is string => Boolean(id)),
      ]),
    ];
    const requestIds = (matchedRequests.data ?? []).map((row) => row.id);
    const searchFilter = [
      `title.ilike.%${escapedSearch}%`,
      `project_number.ilike.%${escapedSearch}%`,
      `description.ilike.%${escapedSearch}%`,
    ];

    if (isUuid(escapedSearch)) {
      searchFilter.push(`id.eq.${escapedSearch}`);
      searchFilter.push(`request_id.eq.${escapedSearch}`);
    }
    if (clientIds.length > 0) {
      searchFilter.push(`client_id.in.(${clientIds.join(",")})`);
    }
    if (requestIds.length > 0) {
      searchFilter.push(`request_id.in.(${requestIds.join(",")})`);
    }

    searchOr = searchFilter.join(",");
  }

  let query = supabase
    .from("projects")
    .select(PROJECT_LIST_COLUMNS, { count: "exact" })
    .order(sort, { ascending, nullsFirst: false });

  if (status) {
    query = query.eq("status", status);
  }
  if (priority) {
    query = query.eq("priority", priority);
  }
  if (searchOr) {
    query = query.or(searchOr);
  }

  if (!isKanban) {
    const from = (requestedPage - 1) * PROJECT_LIST_PAGE_SIZE;
    const to = from + PROJECT_LIST_PAGE_SIZE - 1;
    query = query.range(from, to);
  }

  const { data, error, count } = await query;

  if (error) {
    return toQueryResult(EMPTY_PROJECT_LIST, error, "projects", true);
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PROJECT_LIST_PAGE_SIZE));
  let page = isKanban ? 1 : Math.min(requestedPage, totalPages);
  let rows = (data ?? []) as ProjectRow[];

  if (!isKanban && requestedPage > totalPages && total > 0) {
    const from = (totalPages - 1) * PROJECT_LIST_PAGE_SIZE;
    const to = from + PROJECT_LIST_PAGE_SIZE - 1;
    let clampedQuery = supabase
      .from("projects")
      .select(PROJECT_LIST_COLUMNS)
      .order(sort, { ascending, nullsFirst: false });
    if (status) {
      clampedQuery = clampedQuery.eq("status", status);
    }
    if (priority) {
      clampedQuery = clampedQuery.eq("priority", priority);
    }
    if (searchOr) {
      clampedQuery = clampedQuery.or(searchOr);
    }
    const { data: clampedData, error: clampedError } = await clampedQuery.range(from, to);
    if (clampedError) {
      return toQueryResult(EMPTY_PROJECT_LIST, clampedError, "projects", true);
    }
    rows = (clampedData ?? []) as ProjectRow[];
    page = totalPages;
  }

  const uniqueClientIds = [...new Set(rows.map((row) => row.client_id))];
  const clients = new Map<string, ProjectClient>();

  if (uniqueClientIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, display_name, company_name, avatar_url")
      .in("id", uniqueClientIds);

    for (const profile of profiles ?? []) {
      clients.set(profile.id, profile);
    }
  }

  const items: AdminProjectListItem[] = rows.map((row) => ({
    ...row,
    client: clients.get(row.client_id) ?? null,
  }));

  return {
    status: items.length === 0 && total === 0 ? "empty" : "ok",
    data: {
      items,
      total,
      page,
      pageSize: PROJECT_LIST_PAGE_SIZE,
      totalPages,
    },
  };
}

/**
 * Project header row for the detail page.
 *
 * The client side of the relationship is `projects.client_id -> profiles.id`
 * (FK `projects_client_id_fkey`), and profiles.id is 1:1 with auth.users.id —
 * verified against the live production schema. `getAdminClientDetails` runs the
 * profiles read and the admin-gated auth.users email RPC concurrently, so the
 * added client fields cost the same round-trip count as the single profiles
 * query this replaces.
 */
export async function getAdminProject(
  id: string,
): Promise<QueryResult<AdminProjectDetail>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, project_number, request_id, client_id, title, description, status, priority, currency, estimated_budget, agreed_price, start_date, due_date, completed_at, cancelled_at, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return toQueryResult(
      null as unknown as AdminProjectDetail,
      error,
      "projects",
      true,
    );
  }

  if (!data) {
    return { status: "empty", data: null as unknown as AdminProjectDetail };
  }

  const project = data as ProjectRow;
  const clientDetails = await getAdminClientDetails(project.client_id);

  return {
    status: "ok",
    data: {
      ...project,
      client: toProjectClient(clientDetails),
      clientDetails,
    },
  };
}

export async function getProjectRequirements(
  projectId: string,
): Promise<QueryResult<ProjectRequirementRow | null>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("project_requirements")
    .select("*")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return toQueryResult(
    (data as ProjectRequirementRow | null) ?? null,
    error,
    "project_requirements",
    !data,
  );
}

export async function getProjectMilestones(
  projectId: string,
): Promise<QueryResult<ProjectMilestoneRow[]>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("project_milestones")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const rows = (data ?? []) as ProjectMilestoneRow[];
  return toQueryResult(rows, error, "project_milestones", rows.length === 0);
}

export async function getProjectFiles(
  projectId: string,
): Promise<QueryResult<ProjectFileRow[]>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("project_files")
    .select("*")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as ProjectFileRow[];
  return toQueryResult(rows, error, "project_files", rows.length === 0);
}

export async function getProjectNotes(
  projectId: string,
): Promise<QueryResult<(ProjectNoteRow & { author: ProjectClient | null })[]>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("project_notes")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    return toQueryResult([], error, "project_notes", true);
  }

  const rows = (data ?? []) as ProjectNoteRow[];
  const authorIds = [
    ...new Set(rows.map((row) => row.author_id).filter((id): id is string => Boolean(id))),
  ];
  const authors = new Map<string, ProjectClient>();

  if (authorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, display_name, company_name, avatar_url")
      .in("id", authorIds);

    for (const profile of profiles ?? []) {
      authors.set(profile.id, profile);
    }
  }

  const items = rows.map((row) => ({
    ...row,
    author: row.author_id ? authors.get(row.author_id) ?? null : null,
  }));

  return toQueryResult(items, null, "project_notes", items.length === 0);
}

export async function getProjectMessages(
  projectId: string,
): Promise<QueryResult<(ProjectMessageRow & { sender: ProjectClient | null })[]>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("project_messages")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    return toQueryResult([], error, "project_messages", true);
  }

  const rows = (data ?? []) as ProjectMessageRow[];
  const senderIds = [
    ...new Set(rows.map((row) => row.sender_id).filter((id): id is string => Boolean(id))),
  ];
  const senders = new Map<string, ProjectClient>();

  if (senderIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, display_name, company_name, avatar_url")
      .in("id", senderIds);

    for (const profile of profiles ?? []) {
      senders.set(profile.id, profile);
    }
  }

  const items = rows.map((row) => ({
    ...row,
    sender: row.sender_id ? senders.get(row.sender_id) ?? null : null,
  }));

  return toQueryResult(items, null, "project_messages", items.length === 0);
}

export async function getProjectFinancials(projectId: string): Promise<{
  quotes: QueryResult<QuoteRow[]>;
  discounts: QueryResult<ProjectDiscountRow[]>;
  invoices: QueryResult<InvoiceRow[]>;
  payments: QueryResult<PaymentRow[]>;
}> {
  const supabase = await createServerSupabaseClient();

  const [quotesResult, discountsResult, invoicesResult, paymentsResult] =
    await Promise.all([
      supabase
        .from("quotes")
        .select("*")
        .eq("project_id", projectId)
        .order("version", { ascending: false }),
      supabase
        .from("project_discounts")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
      supabase
        .from("invoices")
        .select("*")
        .eq("project_id", projectId)
        .order("issue_date", { ascending: false }),
      supabase
        .from("payments")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
    ]);

  const quotes = (quotesResult.data ?? []) as QuoteRow[];
  const discounts = (discountsResult.data ?? []) as ProjectDiscountRow[];
  const invoices = (invoicesResult.data ?? []) as InvoiceRow[];
  const payments = (paymentsResult.data ?? []) as PaymentRow[];

  return {
    quotes: toQueryResult(quotes, quotesResult.error, "quotes", quotes.length === 0),
    discounts: toQueryResult(
      discounts,
      discountsResult.error,
      "project_discounts",
      discounts.length === 0,
    ),
    invoices: toQueryResult(
      invoices,
      invoicesResult.error,
      "invoices",
      invoices.length === 0,
    ),
    payments: toQueryResult(
      payments,
      paymentsResult.error,
      "payments",
      payments.length === 0,
    ),
  };
}

export async function getProjectStatusHistory(
  projectId: string,
): Promise<QueryResult<(ProjectStatusHistoryRow & { actor: ProjectClient | null })[]>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("project_status_history")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    return toQueryResult([], error, "project_status_history", true);
  }

  const rows = (data ?? []) as ProjectStatusHistoryRow[];
  const actorIds = [
    ...new Set(rows.map((row) => row.changed_by).filter((id): id is string => Boolean(id))),
  ];
  const actors = new Map<string, ProjectClient>();

  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, display_name, company_name, avatar_url")
      .in("id", actorIds);

    for (const profile of profiles ?? []) {
      actors.set(profile.id, profile);
    }
  }

  const items = rows.map((row) => ({
    ...row,
    actor: row.changed_by ? actors.get(row.changed_by) ?? null : null,
  }));

  return toQueryResult(items, null, "project_status_history", items.length === 0);
}
