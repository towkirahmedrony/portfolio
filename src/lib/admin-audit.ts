import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  AUDIT_LOG_PAGE_SIZE,
  type AdminAuditLogItem,
  type AuditActorOption,
  type AuditFacets,
  type AuditLogFilters,
  type AuditLogListData,
  type QueryResult,
} from "@/lib/admin-audit-constants";
import type { AuditLogRow, ProfileRow } from "@/types/database";

export * from "@/lib/admin-audit-constants";

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

async function fetchActorNames(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  ids: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (ids.length === 0) {
    return names;
  }
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, display_name")
    .in("id", ids);
  for (const profile of (data ?? []) as Pick<
    ProfileRow,
    "id" | "full_name" | "display_name"
  >[]) {
    names.set(
      profile.id,
      profile.display_name?.trim() || profile.full_name.trim() || "Unknown",
    );
  }
  return names;
}

/**
 * Distinct values used to populate the filters. Bounded reads (recent 1000
 * rows) are enough for a debug/inbox page; the filters stay usable even when
 * the volume grows because they only drive selects, not correctness.
 */
export async function getAuditFacets(): Promise<AuditFacets> {
  const supabase = await createServerSupabaseClient();

  // One bounded read of the recent rows instead of three scans of the same
  // table: actor/action/entity facets are derived from the same 1000 rows.
  const { data: rows, error } = await supabase
    .from("audit_logs")
    .select("actor_id, action, entity_type")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    return {
      actors: toQueryResult([], error, "audit_logs", true) as QueryResult<AuditActorOption[]>,
      actions: toQueryResult([], error, "audit_logs", true) as QueryResult<string[]>,
      entities: toQueryResult([], error, "audit_logs", true) as QueryResult<string[]>,
    };
  }

  const latest = rows ?? [];
  const actorIds = [
    ...new Set(latest.map((row) => row.actor_id).filter((v): v is string => Boolean(v))),
  ];
  const names = await fetchActorNames(supabase, actorIds);
  const actors: AuditActorOption[] = actorIds
    .map((id) => ({ id, name: names.get(id) ?? "Unknown" }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const actions = [
    ...new Set(latest.map((row) => row.action)),
  ].sort((a, b) => a.localeCompare(b));
  const entities = [
    ...new Set(latest.map((row) => row.entity_type)),
  ].sort((a, b) => a.localeCompare(b));

  return {
    actors: { status: "ok", data: actors },
    actions: { status: "ok", data: actions },
    entities: { status: "ok", data: entities },
  };
}

/** Audit log page with search + actor/action/entity/date filters. Read-only. */
export async function getAuditLogs(
  filters: AuditLogFilters,
): Promise<QueryResult<AuditLogListData>> {
  const supabase = await createServerSupabaseClient();
  const search = (filters.q ?? "").trim().replace(/[%_,()]/g, " ").trim();
  const action = filters.action?.trim() || null;
  const entity = filters.entity?.trim() || null;
  const actorId = filters.actor?.trim() || null;
  const from = filters.from?.trim() || null;
  const to = filters.to?.trim() || null;
  const ascending = filters.sort === "asc";
  const requestedPage = Math.max(1, Number.parseInt(filters.page ?? "1", 10) || 1);

  // Text search: action/entity_type are text; entity_id and actor are uuid.
  let countQuery = supabase.from("audit_logs").select("id", { count: "exact", head: true });

  if (search) {
    countQuery = countQuery.or(`action.ilike.%${search}%,entity_type.ilike.%${search}%`);
  }
  if (action) countQuery = countQuery.eq("action", action);
  if (entity) countQuery = countQuery.eq("entity_type", entity);
  if (actorId) countQuery = countQuery.eq("actor_id", actorId);
  if (from) countQuery = countQuery.gte("created_at", `${from}T00:00:00.000Z`);
  if (to) countQuery = countQuery.lte("created_at", `${to}T23:59:59.999Z`);

  const fromRow = (requestedPage - 1) * AUDIT_LOG_PAGE_SIZE;
  const toRow = fromRow + AUDIT_LOG_PAGE_SIZE - 1;

  let dataQuery = supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending })
    .order("id", { ascending });

  if (search) {
    dataQuery = dataQuery.or(`action.ilike.%${search}%,entity_type.ilike.%${search}%`);
  }
  if (action) dataQuery = dataQuery.eq("action", action);
  if (entity) dataQuery = dataQuery.eq("entity_type", entity);
  if (actorId) dataQuery = dataQuery.eq("actor_id", actorId);
  if (from) dataQuery = dataQuery.gte("created_at", `${from}T00:00:00.000Z`);
  if (to) dataQuery = dataQuery.lte("created_at", `${to}T23:59:59.999Z`);
  dataQuery = dataQuery.range(fromRow, toRow);

  // Count and page data are independent — run them concurrently instead of
  // waiting for the total before fetching the page.
  const [{ count, error: countError }, { data, error }] = await Promise.all([
    countQuery,
    dataQuery,
  ]);

  if (countError) {
    return toQueryResult(
      { items: [], total: 0, page: 1, totalPages: 1 },
      countError,
      "audit_logs",
      true,
    );
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / AUDIT_LOG_PAGE_SIZE));

  if (error) {
    return toQueryResult(
      { items: [], total: 0, page: 1, totalPages: 1 },
      error,
      "audit_logs",
      true,
    );
  }

  // A hand-edited ?page= beyond the last page: the parallel data query above
  // used the raw requested page, so re-fetch with the clamped range.
  let rows = (data ?? []) as AuditLogRow[];
  if (requestedPage > totalPages) {
    const clampedFromRow = (totalPages - 1) * AUDIT_LOG_PAGE_SIZE;
    const clampedToRow = clampedFromRow + AUDIT_LOG_PAGE_SIZE - 1;
    const { data: clampedData } = await dataQuery.range(clampedFromRow, clampedToRow);
    rows = (clampedData ?? []) as AuditLogRow[];
  }
  const page = Math.min(requestedPage, totalPages);

  const actorIds = [
    ...new Set(rows.map((row) => row.actor_id).filter((v): v is string => Boolean(v))),
  ];
  const names = await fetchActorNames(supabase, actorIds);

  const items: AdminAuditLogItem[] = rows.map((row) => ({
    ...row,
    actorName: row.actor_id ? names.get(row.actor_id) ?? null : null,
  }));

  return {
    status: items.length === 0 && total === 0 ? "empty" : "ok",
    data: { items, total, page, totalPages },
  };
}
