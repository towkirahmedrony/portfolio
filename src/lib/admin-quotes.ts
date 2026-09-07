import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  type ProjectClient,
  type QueryResult,
} from "@/lib/admin-project-constants";
import {
  isQuoteStatus,
  QUOTABLE_REQUEST_STATUSES,
  type AdminQuoteDetail,
  type AdminQuoteListItem,
  type QuoteEligibleRequestListItem,
  type QuoteInvoiceLink,
  type QuoteListFilters,
  type QuoteProjectOption,
  type QuoteProjectSummary,
  type QuoteRequestLink,
} from "@/lib/admin-quote-constants";
import type {
  InvoiceRow,
  ProjectRequestRow,
  QuoteItemRow,
  QuoteRow,
} from "@/types/database";

export * from "@/lib/admin-quote-constants";

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

async function loadClientsByIds(
  ids: string[],
): Promise<Map<string, ProjectClient>> {
  const clients = new Map<string, ProjectClient>();
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return clients;
  }

  const supabase = await createServerSupabaseClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, display_name, company_name, avatar_url")
    .in("id", uniqueIds);

  for (const profile of profiles ?? []) {
    clients.set(profile.id, profile);
  }

  return clients;
}

async function loadProjectsByIds(
  ids: string[],
): Promise<Map<string, QuoteProjectSummary>> {
  const projects = new Map<string, QuoteProjectSummary>();
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return projects;
  }

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("projects")
    .select("id, project_number, title, client_id, currency, request_id")
    .in("id", uniqueIds);

  for (const row of data ?? []) {
    projects.set(row.id, row);
  }

  return projects;
}

async function loadRequestsByIds(
  ids: string[],
): Promise<Map<string, QuoteRequestLink>> {
  const requests = new Map<string, QuoteRequestLink>();
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return requests;
  }

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("project_requests")
    .select("id, request_number, project_type")
    .in("id", uniqueIds);

  for (const row of data ?? []) {
    requests.set(row.id, row);
  }

  return requests;
}

async function loadInvoicesByQuoteIds(
  quoteIds: string[],
): Promise<Map<string, QuoteInvoiceLink>> {
  const invoices = new Map<string, QuoteInvoiceLink>();
  const uniqueIds = [...new Set(quoteIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return invoices;
  }

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, quote_id")
    .in("quote_id", uniqueIds)
    .not("quote_id", "is", null);

  for (const row of (data ?? []) as Array<
    Pick<InvoiceRow, "id" | "invoice_number" | "status" | "quote_id">
  >) {
    if (row.quote_id) {
      invoices.set(row.quote_id, {
        id: row.id,
        invoice_number: row.invoice_number,
        status: row.status,
      });
    }
  }

  return invoices;
}

export async function getAdminQuotes(
  filters: QuoteListFilters,
): Promise<QueryResult<AdminQuoteListItem[]>> {
  const supabase = await createServerSupabaseClient();
  const status = filters.status && isQuoteStatus(filters.status) ? filters.status : null;

  let query = supabase
    .from("quotes")
    .select("*")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    return toQueryResult([], error, "quotes", true);
  }

  const rows = (data ?? []) as QuoteRow[];
  const projects = await loadProjectsByIds(rows.map((row) => row.project_id));
  const requestIds = [...projects.values()]
    .map((project) => project.request_id)
    .filter((id): id is string => Boolean(id));
  const requests = await loadRequestsByIds(requestIds);
  const invoices = await loadInvoicesByQuoteIds(rows.map((row) => row.id));
  const clients = await loadClientsByIds(
    [...projects.values()].map((project) => project.client_id),
  );

  const items: AdminQuoteListItem[] = rows.map((row) => {
    const project = projects.get(row.project_id) ?? null;
    return {
      ...row,
      project,
      request: project?.request_id ? requests.get(project.request_id) ?? null : null,
      client: project ? clients.get(project.client_id) ?? null : null,
      invoice: invoices.get(row.id) ?? null,
    };
  });

  return toQueryResult(items, null, "quotes", items.length === 0);
}

const EMPTY_QUOTE_DETAIL: AdminQuoteDetail = {
  quote: {} as QuoteRow,
  items: [],
  project: null,
  client: null,
  versions: [],
  invoice: null,
};

export async function getAdminQuote(
  quoteId: string,
): Promise<QueryResult<AdminQuoteDetail>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", quoteId)
    .maybeSingle();

  if (error) {
    return toQueryResult(EMPTY_QUOTE_DETAIL, error, "quotes", true);
  }

  if (!data) {
    return { status: "empty", data: EMPTY_QUOTE_DETAIL };
  }

  const quote = data as QuoteRow;
  const [itemsResult, versionsResult, invoiceResult] = await Promise.all([
    supabase
      .from("quote_items")
      .select("*")
      .eq("quote_id", quote.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("quotes")
      .select("*")
      .eq("project_id", quote.project_id)
      .order("version", { ascending: false }),
    supabase
      .from("invoices")
      .select("id, invoice_number, status")
      .eq("quote_id", quote.id)
      .maybeSingle(),
  ]);

  if (itemsResult.error) {
    return toQueryResult(
      {
        ...EMPTY_QUOTE_DETAIL,
        quote,
      },
      itemsResult.error,
      "quote_items",
      true,
    );
  }

  const versions = ((versionsResult.data ?? []) as QuoteRow[]).sort(
    (a, b) => b.version - a.version,
  );
  const projects = await loadProjectsByIds([quote.project_id]);
  const project = projects.get(quote.project_id) ?? null;
  const clients = await loadClientsByIds(project ? [project.client_id] : []);

  return {
    status: "ok",
    data: {
      quote,
      items: (itemsResult.data ?? []) as QuoteItemRow[],
      project,
      client: project ? clients.get(project.client_id) ?? null : null,
      versions,
      invoice: (invoiceResult.data as QuoteInvoiceLink | null) ?? null,
    },
  };
}

export async function getQuoteProjectOptions(): Promise<QueryResult<QuoteProjectOption[]>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, project_number, title, client_id, currency, request_id")
    .order("created_at", { ascending: false });

  if (error) {
    return toQueryResult([], error, "projects", true);
  }

  const rows = (data ?? []) as QuoteProjectSummary[];
  const clients = await loadClientsByIds(rows.map((row) => row.client_id));
  const options = rows.map((row) => ({
    ...row,
    client: clients.get(row.client_id) ?? null,
  }));

  return toQueryResult(options, null, "projects", options.length === 0);
}

export async function getQuoteEligibleProjectRequests(): Promise<
  QueryResult<QuoteEligibleRequestListItem[]>
> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("project_requests")
    .select(
      "id, request_number, client_id, full_name, email, company_name, project_type, service_id, status, budget_min, budget_max, budget_currency, deadline_type, deadline_date, submitted_at",
    )
    .in("status", QUOTABLE_REQUEST_STATUSES)
    .not("client_id", "is", null)
    .order("submitted_at", { ascending: false });

  if (error) {
    return toQueryResult([], error, "project_requests", true);
  }

  const rows = (data ?? []) as ProjectRequestRow[];
  if (rows.length === 0) {
    return toQueryResult([], null, "project_requests", true);
  }

  const requestIds = rows.map((row) => row.id);
  const { data: linkedRows, error: linkedError } = await supabase
    .from("projects")
    .select("request_id")
    .in("request_id", requestIds);

  if (linkedError && !isMissingRelation(linkedError)) {
    return toQueryResult([], linkedError, "projects", true);
  }

  const linkedRequestIds = new Set(
    (linkedRows ?? []).map((row) => row.request_id).filter((id): id is string => Boolean(id)),
  );
  const available = rows.filter(
    (row): row is ProjectRequestRow & { client_id: string } =>
      Boolean(row.client_id) && !linkedRequestIds.has(row.id),
  );
  if (available.length === 0) {
    return toQueryResult([], null, "project_requests", true);
  }

  const clients = await loadClientsByIds(available.map((row) => row.client_id));

  const items: QuoteEligibleRequestListItem[] = available.map((row) => ({
    id: row.id,
    request_number: row.request_number,
    client_id: row.client_id,
    full_name: row.full_name,
    email: row.email,
    company_name: row.company_name,
    project_type: row.project_type,
    service_id: row.service_id,
    status: row.status,
    budget_min: row.budget_min,
    budget_max: row.budget_max,
    budget_currency: row.budget_currency,
    deadline_type: row.deadline_type,
    deadline_date: row.deadline_date,
    submitted_at: row.submitted_at,
    client: row.client_id ? clients.get(row.client_id) ?? null : null,
  }));

  return toQueryResult(items, null, "project_requests", items.length === 0);
}
