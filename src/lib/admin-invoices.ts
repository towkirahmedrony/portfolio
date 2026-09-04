import { createServerSupabaseClient } from "@/lib/supabase/server";
import { type QueryResult } from "@/lib/admin-project-constants";
import {
  isInvoiceOverdue,
  isInvoiceStatus,
  type AcceptedQuoteOption,
  type AdminInvoiceDetail,
  type AdminInvoiceListItem,
  type InvoiceClient,
  type InvoiceListFilters,
  type InvoiceProjectSummary,
} from "@/lib/admin-invoice-constants";
import type { InvoiceItemRow, InvoiceRow, PaymentRow, QuoteRow } from "@/types/database";

export * from "@/lib/admin-invoice-constants";

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

async function loadClientsByIds(ids: string[]): Promise<Map<string, InvoiceClient>> {
  const clients = new Map<string, InvoiceClient>();
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return clients;
  }

  const supabase = await createServerSupabaseClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, display_name, company_name, avatar_url, phone, job_title")
    .in("id", uniqueIds);

  for (const profile of profiles ?? []) {
    clients.set(profile.id, profile);
  }

  return clients;
}

async function loadProjectsByIds(ids: string[]): Promise<Map<string, InvoiceProjectSummary>> {
  const projects = new Map<string, InvoiceProjectSummary>();
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return projects;
  }

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("projects")
    .select("id, project_number, title, client_id, currency")
    .in("id", uniqueIds);

  for (const row of data ?? []) {
    projects.set(row.id, row);
  }

  return projects;
}

export async function getAdminInvoices(
  filters: InvoiceListFilters,
): Promise<QueryResult<AdminInvoiceListItem[]>> {
  const supabase = await createServerSupabaseClient();
  const status = filters.status && isInvoiceStatus(filters.status) ? filters.status : null;

  let query = supabase
    .from("invoices")
    .select("*")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    return toQueryResult([], error, "invoices", true);
  }

  const rows = (data ?? []) as InvoiceRow[];
  const projects = await loadProjectsByIds(rows.map((row) => row.project_id));
  const clients = await loadClientsByIds([
    ...rows.map((row) => row.client_id),
    ...[...projects.values()].map((project) => project.client_id),
  ]);

  const items: AdminInvoiceListItem[] = rows.map((row) => {
    const project = projects.get(row.project_id) ?? null;
    return {
      ...row,
      project,
      client: clients.get(row.client_id) ?? (project ? clients.get(project.client_id) ?? null : null),
      isOverdue: isInvoiceOverdue(row),
    };
  });

  return toQueryResult(items, null, "invoices", items.length === 0);
}

export async function getAdminInvoice(
  invoiceId: string,
): Promise<QueryResult<AdminInvoiceDetail>> {
  const empty: AdminInvoiceDetail = {
    invoice: {} as InvoiceRow,
    items: [],
    project: null,
    client: null,
    quote: null,
    payments: [],
  };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();

  if (error) {
    return toQueryResult(empty, error, "invoices", true);
  }

  if (!data) {
    return { status: "empty", data: empty };
  }

  const invoice = data as InvoiceRow;
  const [itemsResult, paymentsResult, quoteResult] = await Promise.all([
    supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", invoice.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("payments")
      .select("*")
      .eq("invoice_id", invoice.id)
      .order("created_at", { ascending: false }),
    invoice.quote_id
      ? supabase
          .from("quotes")
          .select("id, version, status, total, currency")
          .eq("id", invoice.quote_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (itemsResult.error) {
    return toQueryResult(empty, itemsResult.error, "invoice_items", true);
  }

  if (paymentsResult.error && !isMissingRelation(paymentsResult.error)) {
    return toQueryResult(
      {
        invoice,
        items: (itemsResult.data ?? []) as InvoiceItemRow[],
        project: null,
        client: null,
        quote: null,
        payments: [],
      },
      paymentsResult.error,
      "payments",
      true,
    );
  }

  const projects = await loadProjectsByIds([invoice.project_id]);
  const project = projects.get(invoice.project_id) ?? null;
  const clients = await loadClientsByIds([
    invoice.client_id,
    ...(project ? [project.client_id] : []),
  ]);

  return {
    status: "ok",
    data: {
      invoice,
      items: (itemsResult.data ?? []) as InvoiceItemRow[],
      project,
      client: clients.get(invoice.client_id) ?? (project ? clients.get(project.client_id) ?? null : null),
      quote: (quoteResult.data as AdminInvoiceDetail["quote"]) ?? null,
      payments: (paymentsResult.data ?? []) as PaymentRow[],
    },
  };
}

export async function getAcceptedQuoteOptions(): Promise<QueryResult<AcceptedQuoteOption[]>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("quotes")
    .select("id, project_id, version, total, currency, status")
    .eq("status", "accepted")
    .order("accepted_at", { ascending: false });

  if (error) {
    return toQueryResult([], error, "quotes", true);
  }

  const quotes = (data ?? []) as Array<
    Pick<QuoteRow, "id" | "project_id" | "version" | "total" | "currency" | "status">
  >;

  const { data: existingInvoices, error: existingError } = await supabase
    .from("invoices")
    .select("quote_id")
    .not("quote_id", "is", null);

  if (existingError && !isMissingRelation(existingError)) {
    return toQueryResult([], existingError, "invoices", true);
  }

  const usedQuoteIds = new Set(
    (existingInvoices ?? [])
      .map((row) => row.quote_id)
      .filter((id): id is string => Boolean(id)),
  );

  const available = quotes.filter((quote) => !usedQuoteIds.has(quote.id));
  const projects = await loadProjectsByIds(available.map((quote) => quote.project_id));
  const clients = await loadClientsByIds(
    [...projects.values()].map((project) => project.client_id),
  );

  const options: AcceptedQuoteOption[] = available.map((quote) => {
    const project = projects.get(quote.project_id) ?? null;
    return {
      id: quote.id,
      version: quote.version,
      total: quote.total,
      currency: quote.currency,
      project,
      client: project ? clients.get(project.client_id) ?? null : null,
    };
  });

  return toQueryResult(options, null, "quotes", options.length === 0);
}
