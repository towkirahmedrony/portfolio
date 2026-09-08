import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AuditLogRow, Json } from "@/types/database";

export type ClientQuoteResponseAction =
  | "accepted"
  | "rejected"
  | "change_requested";

export type ClientQuoteResponseItem = {
  id: string;
  action: ClientQuoteResponseAction;
  quoteVersion: number;
  /** Human-facing request number (PR-...), null when the quote is not request-linked. */
  requestNumber: string | null;
  /** Human-facing project number (PJ-...), null before a project exists. */
  projectNumber: string | null;
  clientName: string | null;
  /** Client-supplied message for change requests / rejections, when present. */
  message: string | null;
  /** ISO timestamp of the response. */
  createdAt: string;
};

export type ClientQuoteResponsesResult =
  | { status: "ok"; items: ClientQuoteResponseItem[] }
  | { status: "empty"; items: [] }
  | { status: "error"; message: string }
  | { status: "unavailable"; message: string };

const RESPONSE_ACTIONS = [
  "quote.client_accepted",
  "quote.client_rejected",
  "quote.client_change_requested",
] as const;

type ResponseAuditRow = Pick<
  AuditLogRow,
  "id" | "actor_id" | "action" | "entity_id" | "new_data" | "created_at"
>;

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

function responseAction(action: string): ClientQuoteResponseAction | null {
  switch (action) {
    case "quote.client_accepted":
      return "accepted";
    case "quote.client_rejected":
      return "rejected";
    case "quote.client_change_requested":
      return "change_requested";
    default:
      return null;
  }
}

function payloadMessage(newData: Json | null): string | null {
  if (newData === null || typeof newData !== "object" || Array.isArray(newData)) {
    return null;
  }
  const message = (newData as Record<string, unknown>).message;
  return typeof message === "string" && message.trim().length > 0 ? message : null;
}

/**
 * Recent client responses to quotes (accept / reject / request changes),
 * sourced from audit_logs events written by client_respond_to_quote.
 * Quote context is resolved to PR-/PJ- numbers so the dashboard never shows
 * raw UUIDs.
 */
export async function getRecentClientQuoteResponses(
  limit: number,
): Promise<ClientQuoteResponsesResult> {
  const supabase = await createServerSupabaseClient();

  const { data: rows, error } = await supabase
    .from("audit_logs")
    .select("id, actor_id, action, entity_id, new_data, created_at")
    .eq("entity_type", "quote")
    .in("action", [...RESPONSE_ACTIONS])
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50));

  if (error) {
    if (isMissingRelation(error)) {
      return {
        status: "unavailable",
        message:
          "audit_logs is not available in the current database schema, so client quote responses cannot be shown.",
      };
    }
    return { status: "error", message: error.message };
  }

  const auditRows = (rows ?? []) as ResponseAuditRow[];
  if (auditRows.length === 0) {
    return { status: "empty", items: [] };
  }

  const quoteIds = auditRows
    .map((row) => row.entity_id)
    .filter((id): id is string => Boolean(id));

  const quotesById = new Map<
    string,
    { version: number; project_request_id: string | null; project_id: string | null }
  >();
  const requestIds = new Set<string>();
  const projectIds = new Set<string>();

  if (quoteIds.length > 0) {
    const { data: quoteRows, error: quoteError } = await supabase
      .from("quotes")
      .select("id, version, project_request_id, project_id")
      .in("id", quoteIds);

    if (quoteError) {
      return { status: "error", message: quoteError.message };
    }

    for (const quote of quoteRows ?? []) {
      quotesById.set(quote.id, {
        version: quote.version,
        project_request_id: quote.project_request_id,
        project_id: quote.project_id,
      });
      if (quote.project_request_id) {
        requestIds.add(quote.project_request_id);
      }
      if (quote.project_id) {
        projectIds.add(quote.project_id);
      }
    }
  }

  const requestNumbers = new Map<string, string>();
  const projectNumbers = new Map<string, string>();
  const projectRequestIds = new Map<string, string>();

  if (projectIds.size > 0) {
    const { data: projectRows, error: projectError } = await supabase
      .from("projects")
      .select("id, project_number, request_id")
      .in("id", [...projectIds]);

    if (projectError) {
      return { status: "error", message: projectError.message };
    }

    for (const project of projectRows ?? []) {
      projectNumbers.set(project.id, project.project_number);
      if (project.request_id) {
        projectRequestIds.set(project.id, project.request_id);
        requestIds.add(project.request_id);
      }
    }
  }

  if (requestIds.size > 0) {
    const { data: requestRows, error: requestError } = await supabase
      .from("project_requests")
      .select("id, request_number")
      .in("id", [...requestIds]);

    if (requestError) {
      return { status: "error", message: requestError.message };
    }

    for (const request of requestRows ?? []) {
      requestNumbers.set(request.id, request.request_number);
    }
  }

  const actorIds = auditRows
    .map((row) => row.actor_id)
    .filter((id): id is string => Boolean(id));
  const actorNames = new Map<string, string>();

  if (actorIds.length > 0) {
    const { data: actors } = await supabase
      .from("profiles")
      .select("id, full_name, display_name")
      .in("id", actorIds);

    for (const actor of actors ?? []) {
      const name = actor.display_name?.trim() || actor.full_name.trim();
      if (name) {
        actorNames.set(actor.id, name);
      }
    }
  }

  const items: ClientQuoteResponseItem[] = [];

  for (const row of auditRows) {
    const action = responseAction(row.action);
    if (!action || !row.entity_id) {
      continue;
    }

    const quote = quotesById.get(row.entity_id);
    const requestId = quote?.project_request_id ?? null;
    const projectId = quote?.project_id ?? null;
    const resolvedRequestId = projectId
      ? projectRequestIds.get(projectId) ?? requestId
      : requestId;
    const projectNumber = projectId ? projectNumbers.get(projectId) ?? null : null;
    const requestNumber =
      resolvedRequestId != null ? requestNumbers.get(resolvedRequestId) ?? null : null;

    items.push({
      id: row.id,
      action,
      quoteVersion: quote?.version ?? 0,
      requestNumber,
      projectNumber,
      clientName: row.actor_id ? actorNames.get(row.actor_id) ?? null : null,
      message: payloadMessage(row.new_data),
      createdAt: row.created_at,
    });
  }

  return items.length === 0
    ? { status: "empty", items: [] }
    : { status: "ok", items };
}
