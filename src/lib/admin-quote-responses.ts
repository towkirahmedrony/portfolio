import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AuditLogRow, Json, QuoteRow, QuoteStatus } from "@/types/database";

export type ClientQuoteResponseAction =
  | "accepted"
  | "rejected"
  | "change_requested";

export type ClientQuoteResponseItem = {
  id: string;
  action: ClientQuoteResponseAction;
  /** Quote id — route target when no project exists yet. */
  quoteId: string;
  /** Current quote status (from the quotes table). */
  quoteStatus: QuoteStatus | null;
  quoteVersion: number;
  /** Resolved project id (PJ-...), null when no project exists yet. */
  projectId: string | null;
  /** Resolved project request id (PR-...), null when not request-linked. */
  requestId: string | null;
  /** Human-facing request number (PR-...), null when the quote is not request-linked. */
  requestNumber: string | null;
  /** Human-facing project number (PJ-...), null before a project exists. */
  projectNumber: string | null;
  clientName: string | null;
  /** Client-supplied message for change requests / rejections, when present. */
  message: string | null;
  /** ISO timestamp of the response. */
  createdAt: string;
  /**
   * True only for change-request responses that still need admin action:
   * the quote is still pending (sent/viewed/rejected/expired) and no revised
   * quote version has been sent or accepted after the request.
   */
  open: boolean;
};

export type ClientQuoteResponsesResult =
  | { status: "ok"; items: ClientQuoteResponseItem[] }
  | { status: "empty"; items: [] }
  | { status: "error"; message: string }
  | { status: "unavailable"; message: string };

export type ProjectQuoteChangeRequest = {
  quoteId: string;
  quoteVersion: number;
  quoteStatus: QuoteStatus | null;
  changeRequestedAt: string;
  message: string | null;
  projectNumber: string | null;
  requestNumber: string | null;
  /**
   * Id of the client's project_message carrying the change request, when one
   * exists — lets an admin reply be threaded to it (reply_to_id).
   */
  threadMessageId: string | null;
};

export type ProjectQuoteChangeRequestsResult =
  | { status: "ok"; items: ProjectQuoteChangeRequest[] }
  | { status: "empty"; items: [] }
  | { status: "error"; message: string }
  | { status: "unavailable"; message: string };

const RESPONSE_ACTIONS = [
  "quote.client_accepted",
  "quote.client_rejected",
  "quote.client_change_requested",
] as const;

/** Quote statuses that mean a change request is still awaiting admin review. */
export const PENDING_CHANGE_REQUEST_STATUSES: QuoteStatus[] = [
  "sent",
  "viewed",
  "rejected",
  "expired",
];

/** Statuses of a newer quote version that count as "admin already revised". */
const RESOLVING_SIBLING_STATUSES: QuoteStatus[] = [
  "sent",
  "viewed",
  "accepted",
];

const QUOTE_SELECT_COLUMNS =
  "id, version, status, created_at, project_request_id, project_id, client_change_requested_at, client_change_message";

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
 * True when a quote change request has not yet been answered by a revised
 * quote version. `siblings` must contain every other quote version of the same
 * scope (project request, or project when the quote is not request-linked).
 */
export function isQuoteChangeRequestPending(
  quote: {
    status: QuoteStatus | null;
    createdAt: string;
  },
  siblings: Array<{ status: QuoteStatus | null; createdAt: string }>,
): boolean {
  if (!quote.status || !PENDING_CHANGE_REQUEST_STATUSES.includes(quote.status)) {
    return false;
  }
  const requestedAt = new Date(quote.createdAt).getTime();
  if (Number.isNaN(requestedAt)) {
    return false;
  }
  return !siblings.some((sibling) => {
    if (
      !sibling.status ||
      !RESOLVING_SIBLING_STATUSES.includes(sibling.status)
    ) {
      return false;
    }
    const siblingAt = new Date(sibling.createdAt).getTime();
    return !Number.isNaN(siblingAt) && siblingAt > requestedAt;
  });
}

function scopeKey(quote: {
  project_request_id: string | null;
  project_id: string | null;
}): string | null {
  return quote.project_request_id ?? quote.project_id ?? null;
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

  const quotesById = new Map<string, QuoteRow>();
  const requestIds = new Set<string>();
  const projectIds = new Set<string>();

  if (quoteIds.length > 0) {
    const { data: quoteRows, error: quoteError } = await supabase
      .from("quotes")
      .select(QUOTE_SELECT_COLUMNS)
      .in("id", quoteIds);

    if (quoteError) {
      return { status: "error", message: quoteError.message };
    }

    for (const quote of (quoteRows ?? []) as QuoteRow[]) {
      quotesById.set(quote.id, quote);
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

  // Change-request events need sibling versions of the same scope (request, or
  // project when the quote has no request link) to know whether the admin has
  // already sent/accepted a revised version after the request.
  const changeQuotes: Array<{ row: ResponseAuditRow; quote: QuoteRow }> = [];

  for (const row of auditRows) {
    if (row.action !== "quote.client_change_requested" || !row.entity_id) {
      continue;
    }
    const quote = quotesById.get(row.entity_id);
    if (!quote) {
      continue;
    }
    changeQuotes.push({ row, quote });
  }

  const scopedRequestIds = new Set<string>();
  const scopedProjectIds = new Set<string>();
  for (const { quote } of changeQuotes) {
    if (quote.project_request_id) {
      scopedRequestIds.add(quote.project_request_id);
    } else if (quote.project_id) {
      scopedProjectIds.add(quote.project_id);
    }
  }

  const scopeVersions = new Map<string, Array<{ id: string; status: QuoteStatus; createdAt: string }>>();

  function collectSiblings(rows: QuoteRow[], keyOf: (row: QuoteRow) => string | null) {
    for (const row of rows) {
      const key = keyOf(row);
      if (!key) {
        continue;
      }
      const list = scopeVersions.get(key) ?? [];
      list.push({ id: row.id, status: row.status, createdAt: row.created_at });
      scopeVersions.set(key, list);
    }
  }

  if (scopedRequestIds.size > 0) {
    const { data: siblingRows, error: siblingError } = await supabase
      .from("quotes")
      .select("id, status, created_at, project_request_id, project_id")
      .in("project_request_id", [...scopedRequestIds]);

    if (siblingError) {
      return { status: "error", message: siblingError.message };
    }
    collectSiblings((siblingRows ?? []) as QuoteRow[], (row) => row.project_request_id);
  }

  if (scopedProjectIds.size > 0) {
    const { data: siblingRows, error: siblingError } = await supabase
      .from("quotes")
      .select("id, status, created_at, project_request_id, project_id")
      .in("project_id", [...scopedProjectIds]);

    if (siblingError) {
      return { status: "error", message: siblingError.message };
    }
    collectSiblings((siblingRows ?? []) as QuoteRow[], (row) => row.project_id);
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

    let open = false;
    if (action === "change_requested" && quote) {
      const key = scopeKey(quote);
      const siblings = key
        ? (scopeVersions.get(key) ?? []).filter((sibling) => sibling.id !== quote.id)
        : [];
      open = isQuoteChangeRequestPending(
        { status: quote.status, createdAt: row.created_at },
        siblings,
      );
    }

    items.push({
      id: row.id,
      action,
      quoteId: row.entity_id,
      quoteStatus: quote?.status ?? null,
      quoteVersion: quote?.version ?? 0,
      projectId,
      requestId: resolvedRequestId,
      requestNumber,
      projectNumber,
      clientName: row.actor_id ? actorNames.get(row.actor_id) ?? null : null,
      message: payloadMessage(row.new_data) ?? quote?.client_change_message ?? null,
      createdAt: row.created_at,
      open,
    });
  }

  return items.length === 0
    ? { status: "empty", items: [] }
    : { status: "ok", items };
}

/**
 * Open (unanswered) quote change requests tied to a project, either because the
 * quote belongs to the project directly or because the project came from the
 * same project request (PR -> PJ). Lets the project page surface "client asked
 * for changes" with a direct, context-bound reply path.
 */
export async function getProjectQuoteChangeRequests(
  projectId: string,
): Promise<ProjectQuoteChangeRequestsResult> {
  const supabase = await createServerSupabaseClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, project_number, request_id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    return isMissingRelation(projectError)
      ? {
          status: "unavailable",
          message:
            "projects is not available in the current database schema, so quote change requests cannot be shown.",
        }
      : { status: "error", message: projectError.message };
  }
  if (!project) {
    return { status: "empty", items: [] };
  }

  // Quotes linked to the project directly or through the originating request.
  const candidates = new Map<string, QuoteRow>();

  if (project.request_id) {
    const { data: rows, error: requestError } = await supabase
      .from("quotes")
      .select(QUOTE_SELECT_COLUMNS)
      .eq("project_request_id", project.request_id)
      .not("client_change_requested_at", "is", null)
      .order("client_change_requested_at", { ascending: false });

    if (requestError) {
      return isMissingRelation(requestError)
        ? {
            status: "unavailable",
            message:
              "quotes is not available in the current database schema, so quote change requests cannot be shown.",
          }
        : { status: "error", message: requestError.message };
    }
    for (const quote of (rows ?? []) as QuoteRow[]) {
      candidates.set(quote.id, quote);
    }
  }

  const { data: directRows, error: directError } = await supabase
    .from("quotes")
    .select(QUOTE_SELECT_COLUMNS)
    .eq("project_id", projectId)
    .not("client_change_requested_at", "is", null)
    .order("client_change_requested_at", { ascending: false });

  if (directError) {
    return isMissingRelation(directError)
      ? {
          status: "unavailable",
          message:
            "quotes is not available in the current database schema, so quote change requests cannot be shown.",
        }
      : { status: "error", message: directError.message };
  }
  for (const quote of (directRows ?? []) as QuoteRow[]) {
    candidates.set(quote.id, quote);
  }

  if (candidates.size === 0) {
    return { status: "empty", items: [] };
  }

  // Resolve open state: no revised version sent/accepted after the request.
  const scopeIds = new Set<string>();
  for (const quote of candidates.values()) {
    const key = scopeKey(quote);
    if (key) {
      scopeIds.add(key);
    }
  }
  const scopeVersions = new Map<string, Array<{ id: string; status: QuoteStatus; createdAt: string }>>();
  const requestScopeIds = [...scopeIds].filter((key) =>
    [...candidates.values()].some((quote) => quote.project_request_id === key),
  );
  const projectScopeIds = [...scopeIds].filter((key) =>
    [...candidates.values()].some(
      (quote) => !quote.project_request_id && quote.project_id === key,
    ),
  );

  if (requestScopeIds.length > 0) {
    const { data: rows, error: siblingError } = await supabase
      .from("quotes")
      .select("id, status, created_at, project_request_id, project_id")
      .in("project_request_id", requestScopeIds);

    if (!siblingError) {
      for (const row of (rows ?? []) as QuoteRow[]) {
        const list = scopeVersions.get(row.project_request_id!) ?? [];
        list.push({ id: row.id, status: row.status, createdAt: row.created_at });
        scopeVersions.set(row.project_request_id!, list);
      }
    }
  }

  if (projectScopeIds.length > 0) {
    const { data: rows, error: siblingError } = await supabase
      .from("quotes")
      .select("id, status, created_at, project_request_id, project_id")
      .in("project_id", projectScopeIds);

    if (!siblingError) {
      for (const row of (rows ?? []) as QuoteRow[]) {
        const list = scopeVersions.get(row.project_id!) ?? [];
        list.push({ id: row.id, status: row.status, createdAt: row.created_at });
        scopeVersions.set(row.project_id!, list);
      }
    }
  }

  // The client's own change-request message rows in the project thread, so an
  // admin reply can be threaded to the exact message (reply_to_id).
  const { data: messageRows } = await supabase
    .from("project_messages")
    .select("id, sender_id, message")
    .eq("project_id", projectId)
    .limit(200);

  const clientMessageByQuoteVersion = new Map<number, string>();
  for (const message of messageRows ?? []) {
    const match = /^Client requested changes on quote v(\d+):/i.exec(message.message ?? "");
    if (match) {
      clientMessageByQuoteVersion.set(Number(match[1]), message.id);
    }
  }

  const requestNumberByRequestId = new Map<string, string>();
  if (project.request_id) {
    const { data: requestRow } = await supabase
      .from("project_requests")
      .select("id, request_number")
      .eq("id", project.request_id)
      .maybeSingle();
    if (requestRow?.request_number) {
      requestNumberByRequestId.set(project.request_id, requestRow.request_number);
    }
  }

  const items: ProjectQuoteChangeRequest[] = [];

  for (const quote of candidates.values()) {
    const key = scopeKey(quote);
    const siblings = key
      ? (scopeVersions.get(key) ?? []).filter((sibling) => sibling.id !== quote.id)
      : [];
    const pending = isQuoteChangeRequestPending(
      {
        status: quote.status,
        createdAt: quote.client_change_requested_at ?? quote.created_at,
      },
      siblings,
    );
    if (!pending || !quote.client_change_requested_at) {
      continue;
    }

    items.push({
      quoteId: quote.id,
      quoteVersion: quote.version,
      quoteStatus: quote.status,
      changeRequestedAt: quote.client_change_requested_at,
      message: quote.client_change_message ?? null,
      projectNumber: project.project_number,
      requestNumber: project.request_id
        ? requestNumberByRequestId.get(project.request_id) ?? null
        : null,
      threadMessageId: clientMessageByQuoteVersion.get(quote.version) ?? null,
    });
  }

  items.sort(
    (a, b) =>
      new Date(b.changeRequestedAt).getTime() - new Date(a.changeRequestedAt).getTime(),
  );

  return items.length === 0
    ? { status: "empty", items: [] }
    : { status: "ok", items };
}
