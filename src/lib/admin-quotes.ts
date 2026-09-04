import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  type ProjectClient,
  type QueryResult,
} from "@/lib/admin-project-constants";
import {
  isQuoteStatus,
  type AdminQuoteDetail,
  type AdminQuoteListItem,
  type QuoteListFilters,
  type QuoteProjectOption,
  type QuoteProjectSummary,
} from "@/lib/admin-quote-constants";
import type { QuoteItemRow, QuoteRow } from "@/types/database";

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
    .select("id, project_number, title, client_id, currency")
    .in("id", uniqueIds);

  for (const row of data ?? []) {
    projects.set(row.id, row);
  }

  return projects;
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
  const clients = await loadClientsByIds(
    [...projects.values()].map((project) => project.client_id),
  );

  const items: AdminQuoteListItem[] = rows.map((row) => {
    const project = projects.get(row.project_id) ?? null;
    return {
      ...row,
      project,
      client: project ? clients.get(project.client_id) ?? null : null,
    };
  });

  return toQueryResult(items, null, "quotes", items.length === 0);
}

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
    return toQueryResult(
      {
        quote: {} as QuoteRow,
        items: [],
        project: null,
        client: null,
        versions: [],
      },
      error,
      "quotes",
      true,
    );
  }

  if (!data) {
    return {
      status: "empty",
      data: {
        quote: {} as QuoteRow,
        items: [],
        project: null,
        client: null,
        versions: [],
      },
    };
  }

  const quote = data as QuoteRow;
  const [itemsResult, versionsResult] = await Promise.all([
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
  ]);

  if (itemsResult.error) {
    return toQueryResult(
      {
        quote,
        items: [],
        project: null,
        client: null,
        versions: [],
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
    },
  };
}

export async function getQuoteProjectOptions(): Promise<QueryResult<QuoteProjectOption[]>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, project_number, title, client_id, currency")
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
