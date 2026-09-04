import { createServerSupabaseClient } from "@/lib/supabase/server";
import { type QueryResult } from "@/lib/admin-project-constants";
import {
  isPaymentStatus,
  isPaymentType,
  type AdminPaymentListItem,
  type InvoiceClient,
  type InvoiceProjectSummary,
  type PaymentEventListFilters,
  type PaymentListFilters,
} from "@/lib/admin-invoice-constants";
import type { InvoiceRow, PaymentEventRow, PaymentRow } from "@/types/database";

export type { PaymentEventListFilters, PaymentListFilters } from "@/lib/admin-invoice-constants";

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

async function loadInvoicesByIds(
  ids: string[],
): Promise<Map<string, Pick<InvoiceRow, "id" | "invoice_number" | "status" | "currency">>> {
  const invoices = new Map<string, Pick<InvoiceRow, "id" | "invoice_number" | "status" | "currency">>();
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return invoices;
  }

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, currency")
    .in("id", uniqueIds);

  for (const row of data ?? []) {
    invoices.set(row.id, row);
  }

  return invoices;
}

export async function getAdminPayments(
  filters: PaymentListFilters,
): Promise<QueryResult<AdminPaymentListItem[]>> {
  const supabase = await createServerSupabaseClient();
  const status = filters.status && isPaymentStatus(filters.status) ? filters.status : null;
  const type = filters.type && isPaymentType(filters.type) ? filters.type : null;

  let query = supabase
    .from("payments")
    .select("*")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }
  if (type) {
    query = query.eq("payment_type", type);
  }

  const { data, error } = await query;
  if (error) {
    return toQueryResult([], error, "payments", true);
  }

  const rows = (data ?? []) as PaymentRow[];
  const [projects, clients, invoices] = await Promise.all([
    loadProjectsByIds(rows.map((row) => row.project_id)),
    loadClientsByIds(rows.map((row) => row.client_id)),
    loadInvoicesByIds(rows.map((row) => row.invoice_id)),
  ]);

  const items: AdminPaymentListItem[] = rows.map((row) => ({
    ...row,
    project: projects.get(row.project_id) ?? null,
    client: clients.get(row.client_id) ?? null,
    invoice: invoices.get(row.invoice_id) ?? null,
  }));

  return toQueryResult(items, null, "payments", items.length === 0);
}

export async function getAdminPaymentEvents(
  filters: PaymentEventListFilters,
): Promise<QueryResult<PaymentEventRow[]>> {
  const supabase = await createServerSupabaseClient();
  const search = filters.q?.trim() ?? "";
  const processed =
    filters.processed === "true" ? true : filters.processed === "false" ? false : null;
  const provider = filters.provider?.trim() ?? "";

  let query = supabase
    .from("payment_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (processed !== null) {
    query = query.eq("processed", processed);
  }
  if (provider) {
    query = query.ilike("provider", `%${provider}%`);
  }
  if (search) {
    const escaped = search.replace(/[%_,]/g, " ").trim();
    if (escaped) {
      query = query.or(
        `event_id.ilike.%${escaped}%,event_type.ilike.%${escaped}%,provider.ilike.%${escaped}%,error_message.ilike.%${escaped}%`,
      );
    }
  }

  const { data, error } = await query;
  return toQueryResult((data ?? []) as PaymentEventRow[], error, "payment_events", (data ?? []).length === 0);
}
