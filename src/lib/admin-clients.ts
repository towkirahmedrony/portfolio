import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  CLIENT_LIST_PAGE_SIZE,
  isClientSortField,
  isClientStatus,
  type AdminClientDetail,
  type AdminClientListData,
  type AdminClientListItem,
  type ClientListFilters,
  type QueryResult,
} from "@/lib/admin-client-constants";
import type {
  InvoiceRow,
  PaymentRow,
  ProfileRow,
  ProfileStatus,
  ProjectMessageRow,
  ProjectRequestRow,
  ProjectRow,
  QuoteRow,
  ReferralCodeRow,
  ReferralRewardRow,
} from "@/types/database";

export * from "@/lib/admin-client-constants";

export const CLIENT_LIST_COLUMNS =
  "id, full_name, display_name, avatar_url, phone, company_name, job_title, role, status, email_verified, created_at, updated_at, last_seen_at";

export type ClientProjectSummaryRow = Pick<
  ProjectRow,
  "id" | "project_number" | "title" | "status" | "created_at"
>;

export type ClientRequestSummaryRow = Pick<
  ProjectRequestRow,
  "id" | "request_number" | "project_type" | "status" | "submitted_at"
>;

export type ClientQuoteSummaryRow = Pick<
  QuoteRow,
  "id" | "project_id" | "version" | "currency" | "total" | "status" | "created_at"
>;

export type ClientInvoiceSummaryRow = Pick<
  InvoiceRow,
  | "id"
  | "invoice_number"
  | "project_id"
  | "currency"
  | "total"
  | "amount_due"
  | "status"
  | "issue_date"
>;

export type ClientPaymentSummaryRow = Pick<
  PaymentRow,
  | "id"
  | "invoice_id"
  | "project_id"
  | "amount"
  | "currency"
  | "payment_type"
  | "status"
  | "created_at"
>;

export type ClientMessageSummaryRow = Pick<
  ProjectMessageRow,
  "id" | "project_id" | "sender_id" | "message" | "is_read" | "created_at"
>;

export type ClientProjectContext = {
  id: string;
  project_number: string;
  title: string;
};

export type ClientSummarySection<T> = QueryResult<{
  total: number;
  rows: T[];
}>;

export type AdminClientRelatedData = {
  projects: ClientSummarySection<ClientProjectSummaryRow>;
  requests: ClientSummarySection<ClientRequestSummaryRow>;
  quotes: ClientSummarySection<ClientQuoteSummaryRow>;
  invoices: ClientSummarySection<ClientInvoiceSummaryRow>;
  payments: ClientSummarySection<ClientPaymentSummaryRow>;
  messages: ClientSummarySection<ClientMessageSummaryRow>;
  referralCodes: QueryResult<ReferralCodeRow[]>;
  referralRewards: QueryResult<ReferralRewardRow[]>;
  projectsById: Map<string, ClientProjectContext>;
};

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

function sectionResult<T>(
  rows: T[],
  total: number,
  error: { message?: string; code?: string } | null,
  table: string,
): ClientSummarySection<T> {
  if (error) {
    const base = toQueryResult<{ total: number; rows: T[] }>(
      { total: 0, rows: [] },
      error,
      table,
      true,
    );
    return base as ClientSummarySection<T>;
  }

  return { status: rows.length === 0 ? "empty" : "ok", data: { total, rows } };
}

function toClientItem(profile: ProfileRow): AdminClientListItem {
  return {
    id: profile.id,
    full_name: profile.full_name,
    display_name: profile.display_name,
    avatar_url: profile.avatar_url,
    phone: profile.phone,
    company_name: profile.company_name,
    job_title: profile.job_title,
    role: "client",
    status: profile.status as ProfileStatus,
    email_verified: profile.email_verified,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
    last_seen_at: profile.last_seen_at,
    email: null,
  };
}

async function fetchAuthEmails(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  ids: string[],
): Promise<{ emails: Map<string, string>; available: boolean }> {
  if (ids.length === 0) {
    return { emails: new Map(), available: true };
  }

  const { data, error } = await supabase.rpc("admin_auth_emails", {
    p_ids: ids,
  });

  if (error) {
    return { emails: new Map(), available: false };
  }

  const emails = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.email) {
      emails.set(row.profile_id, row.email);
    }
  }
  return { emails, available: true };
}

/**
 * List client profiles (role = client) with search, status filter, sorting and
 * pagination. Emails are attached from auth.users when the admin_auth_emails
 * RPC is available; otherwise `emailsAvailable` is false.
 */
export async function getAdminClients(
  filters: ClientListFilters,
): Promise<QueryResult<AdminClientListData>> {
  const supabase = await createServerSupabaseClient();
  const search = (filters.q ?? "").trim();
  const status =
    filters.status && isClientStatus(filters.status) ? filters.status : null;
  const sort =
    filters.sort && isClientSortField(filters.sort) ? filters.sort : "created_at";
  const ascending = filters.dir === "asc";
  const requestedPage = Math.max(1, Number.parseInt(filters.page ?? "1", 10) || 1);

  // Searchable columns live on profiles. Email is not searchable here because
  // profiles intentionally do not store it (it lives in auth.users).
  const escapedSearch = search.replace(/[%_,()]/g, " ").trim();
  const searchFilter = escapedSearch
    ? [
        `full_name.ilike.%${escapedSearch}%`,
        `display_name.ilike.%${escapedSearch}%`,
        `phone.ilike.%${escapedSearch}%`,
        `company_name.ilike.%${escapedSearch}%`,
        `job_title.ilike.%${escapedSearch}%`,
      ].join(",")
    : null;

  let countQuery = supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "client");

  if (status) {
    countQuery = countQuery.eq("status", status);
  }
  if (searchFilter) {
    countQuery = countQuery.or(searchFilter);
  }

  const { count, error: countError } = await countQuery;
  if (countError) {
    return toQueryResult(
      null as unknown as AdminClientListData,
      countError,
      "profiles",
      true,
    );
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / CLIENT_LIST_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const from = (page - 1) * CLIENT_LIST_PAGE_SIZE;
  const to = from + CLIENT_LIST_PAGE_SIZE - 1;

  let dataQuery = supabase
    .from("profiles")
    .select(CLIENT_LIST_COLUMNS)
    .eq("role", "client")
    .order(sort, { ascending, nullsFirst: false });

  if (status) {
    dataQuery = dataQuery.eq("status", status);
  }
  if (searchFilter) {
    dataQuery = dataQuery.or(searchFilter);
  }
  dataQuery = dataQuery.range(from, to);

  const { data, error } = await dataQuery;
  if (error) {
    return toQueryResult(
      null as unknown as AdminClientListData,
      error,
      "profiles",
      true,
    );
  }

  const items = (data ?? []).map(toClientItem);
  const emails = await fetchAuthEmails(
    supabase,
    items.map((item) => item.id),
  );

  for (const item of items) {
    item.email = emails.emails.get(item.id) ?? null;
  }

  return {
    status: items.length === 0 && total === 0 ? "empty" : "ok",
    data: {
      items,
      emailsAvailable: emails.available,
      total,
      page,
      pageSize: CLIENT_LIST_PAGE_SIZE,
      totalPages,
    },
  };
}

/** Fetch a single client profile (must be role = client). */
export async function getAdminClient(
  id: string,
): Promise<QueryResult<AdminClientDetail | null>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(CLIENT_LIST_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return toQueryResult(null as unknown as AdminClientDetail, error, "profiles", true);
  }

  const profile = data as ProfileRow | null;
  if (!profile || profile.role !== "client") {
    return { status: "empty", data: null };
  }

  const emails = await fetchAuthEmails(supabase, [profile.id]);
  const item = toClientItem(profile);
  item.email = emails.emails.get(profile.id) ?? null;

  return { status: "ok", data: item };
}

async function fetchProjects(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  clientId: string,
): Promise<{
  section: ClientSummarySection<ClientProjectSummaryRow>;
  projectsById: Map<string, ClientProjectContext>;
  projectIds: string[];
}> {
  const { data, error } = await supabase
    .from("projects")
    .select("id, project_number, title, status, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as ClientProjectSummaryRow[];
  const projectsById = new Map<string, ClientProjectContext>();
  for (const row of rows) {
    projectsById.set(row.id, {
      id: row.id,
      project_number: row.project_number,
      title: row.title,
    });
  }

  return {
    section: sectionResult(rows, rows.length, error, "projects"),
    projectsById,
    projectIds: rows.map((row) => row.id),
  };
}

async function fetchRequests(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  clientId: string,
): Promise<ClientSummarySection<ClientRequestSummaryRow>> {
  const { count, error: countError } = await supabase
    .from("project_requests")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId);

  if (countError) {
    return sectionResult<ClientRequestSummaryRow>([], 0, countError, "project_requests");
  }

  const total = count ?? 0;
  const { data, error } = await supabase
    .from("project_requests")
    .select("id, request_number, project_type, status, submitted_at")
    .eq("client_id", clientId)
    .order("submitted_at", { ascending: false })
    .limit(5);

  return sectionResult(
    (data ?? []) as ClientRequestSummaryRow[],
    total,
    error,
    "project_requests",
  );
}

async function fetchQuotes(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  projectIds: string[],
): Promise<ClientSummarySection<ClientQuoteSummaryRow>> {
  const { count, error: countError } = await supabase
    .from("quotes")
    .select("id", { count: "exact", head: true })
    .in("project_id", projectIds);

  if (countError) {
    return sectionResult<ClientQuoteSummaryRow>([], 0, countError, "quotes");
  }

  const total = count ?? 0;
  const { data, error } = await supabase
    .from("quotes")
    .select("id, project_id, version, currency, total, status, created_at")
    .in("project_id", projectIds)
    .order("created_at", { ascending: false })
    .limit(5);

  return sectionResult((data ?? []) as ClientQuoteSummaryRow[], total, error, "quotes");
}

async function fetchInvoices(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  clientId: string,
): Promise<ClientSummarySection<ClientInvoiceSummaryRow>> {
  const { count, error: countError } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId);

  if (countError) {
    return sectionResult<ClientInvoiceSummaryRow>([], 0, countError, "invoices");
  }

  const total = count ?? 0;
  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, project_id, currency, total, amount_due, status, issue_date")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(5);

  return sectionResult((data ?? []) as ClientInvoiceSummaryRow[], total, error, "invoices");
}

async function fetchPayments(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  clientId: string,
): Promise<ClientSummarySection<ClientPaymentSummaryRow>> {
  const { count, error: countError } = await supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId);

  if (countError) {
    return sectionResult<ClientPaymentSummaryRow>([], 0, countError, "payments");
  }

  const total = count ?? 0;
  const { data, error } = await supabase
    .from("payments")
    .select("id, invoice_id, project_id, amount, currency, payment_type, status, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(5);

  return sectionResult((data ?? []) as ClientPaymentSummaryRow[], total, error, "payments");
}

async function fetchMessages(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  projectIds: string[],
): Promise<ClientSummarySection<ClientMessageSummaryRow>> {
  const { count, error: countError } = await supabase
    .from("project_messages")
    .select("id", { count: "exact", head: true })
    .in("project_id", projectIds);

  if (countError) {
    return sectionResult<ClientMessageSummaryRow>([], 0, countError, "project_messages");
  }

  const total = count ?? 0;
  const { data, error } = await supabase
    .from("project_messages")
    .select("id, project_id, sender_id, message, is_read, created_at")
    .in("project_id", projectIds)
    .order("created_at", { ascending: false })
    .limit(5);

  return sectionResult((data ?? []) as ClientMessageSummaryRow[], total, error, "project_messages");
}

/**
 * Related summaries for one client. Every relationship is read from the
 * existing tables (profiles → projects / project_requests; quotes, invoices,
 * payments and project_messages via their own FKs to profiles/projects)
 * instead of duplicating data. Each section degrades independently when a
 * table is not present in the current schema.
 */
export async function getAdminClientRelatedData(
  clientId: string,
): Promise<AdminClientRelatedData> {
  const supabase = await createServerSupabaseClient();

  const { section: projects, projectsById, projectIds } =
    await fetchProjects(supabase, clientId);

  const [requests, quotes, invoices, payments, messages] = await Promise.all([
    fetchRequests(supabase, clientId),
    projectIds.length > 0
      ? fetchQuotes(supabase, projectIds)
      : Promise.resolve<ClientSummarySection<ClientQuoteSummaryRow>>({
          status: "empty",
          data: { total: 0, rows: [] },
        }),
    fetchInvoices(supabase, clientId),
    fetchPayments(supabase, clientId),
    projectIds.length > 0
      ? fetchMessages(supabase, projectIds)
      : Promise.resolve<ClientSummarySection<ClientMessageSummaryRow>>({
          status: "empty",
          data: { total: 0, rows: [] },
        }),
  ]);

  const codesQuery = await supabase
    .from("referral_codes")
    .select("*")
    .eq("owner_id", clientId)
    .order("created_at", { ascending: false });

  const rewardsQuery = await supabase
    .from("referral_rewards")
    .select("*")
    .eq("referrer_id", clientId)
    .order("created_at", { ascending: false });

  const codes = (codesQuery.data ?? []) as ReferralCodeRow[];
  const rewards = (rewardsQuery.data ?? []) as ReferralRewardRow[];

  return {
    projects,
    requests,
    quotes,
    invoices,
    payments,
    messages,
    referralCodes: toQueryResult(
      codes,
      codesQuery.error,
      "referral_codes",
      codes.length === 0,
    ),
    referralRewards: toQueryResult(
      rewards,
      rewardsQuery.error,
      "referral_rewards",
      rewards.length === 0,
    ),
    projectsById,
  };
}
