import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/admin-dashboard";
import {
  isProjectPriority,
  isProjectSortField,
  isProjectStatus,
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

export async function getAdminProjects(
  filters: ProjectListFilters,
): Promise<QueryResult<AdminProjectListItem[]>> {
  const supabase = await createServerSupabaseClient();
  const search = filters.q?.trim() ?? "";
  const status = filters.status && isProjectStatus(filters.status) ? filters.status : null;
  const priority =
    filters.priority && isProjectPriority(filters.priority) ? filters.priority : null;
  const sort = filters.sort && isProjectSortField(filters.sort) ? filters.sort : "created_at";
  const ascending = filters.dir === "asc";

  let clientIds: string[] | null = null;

  if (search) {
    const escaped = search.replace(/[%_,()]/g, " ").trim();
    if (escaped) {
      const { data: matchedClients } = await supabase
        .from("profiles")
        .select("id")
        .or(
          `full_name.ilike.%${escaped}%,display_name.ilike.%${escaped}%,company_name.ilike.%${escaped}%`,
        );

      clientIds = (matchedClients ?? []).map((row) => row.id);
    }
  }

  let query = supabase
    .from("projects")
    .select(
      "id, project_number, request_id, client_id, title, description, status, priority, currency, estimated_budget, agreed_price, start_date, due_date, completed_at, cancelled_at, created_at, updated_at",
    )
    .order(sort, { ascending, nullsFirst: false });

  if (status) {
    query = query.eq("status", status);
  }

  if (priority) {
    query = query.eq("priority", priority);
  }

  const escapedSearch = search.replace(/[%_,()]/g, " ").trim();
  if (escapedSearch) {
    const searchFilter = [
      `title.ilike.%${escapedSearch}%`,
      `project_number.ilike.%${escapedSearch}%`,
      `description.ilike.%${escapedSearch}%`,
    ];
    if (clientIds && clientIds.length > 0) {
      searchFilter.push(`client_id.in.(${clientIds.join(",")})`);
    }
    query = query.or(searchFilter.join(","));
  }

  const { data, error } = await query;

  if (error) {
    return toQueryResult([], error, "projects", true);
  }

  const rows = (data ?? []) as ProjectRow[];
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

  return toQueryResult(items, null, "projects", items.length === 0);
}

export async function getAdminProject(id: string): Promise<QueryResult<AdminProjectListItem>> {
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
      null as unknown as AdminProjectListItem,
      error,
      "projects",
      true,
    );
  }

  if (!data) {
    return { status: "empty", data: null as unknown as AdminProjectListItem };
  }

  const project = data as ProjectRow;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, display_name, company_name, avatar_url")
    .eq("id", project.client_id)
    .maybeSingle();

  return {
    status: "ok",
    data: {
      ...project,
      client: profile ?? null,
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
  const authorIds = [...new Set(rows.map((row) => row.author_id))];
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
    author: authors.get(row.author_id) ?? null,
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
  const senderIds = [...new Set(rows.map((row) => row.sender_id))];
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
    sender: senders.get(row.sender_id) ?? null,
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
