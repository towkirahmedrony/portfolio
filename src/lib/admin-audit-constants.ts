import type { QueryResult } from "@/lib/admin-project-constants";
import type { AuditLogRow, Json } from "@/types/database";

export { formatDate, formatDateTime } from "@/lib/admin-project-constants";
export type { QueryResult, AuditLogRow, Json };

export const AUDIT_LOG_PAGE_SIZE = 50;

export const AUDIT_SORT_OPTIONS = [
  { value: "desc", label: "Newest first" },
  { value: "asc", label: "Oldest first" },
] as const;

export type AuditLogFilters = {
  q?: string;
  actor?: string;
  action?: string;
  entity?: string;
  from?: string;
  to?: string;
  sort?: string;
  page?: string;
};

export type AuditActorOption = {
  id: string;
  name: string;
};

export type AuditFacets = {
  actors: QueryResult<AuditActorOption[]>;
  actions: QueryResult<string[]>;
  entities: QueryResult<string[]>;
};

export type AdminAuditLogItem = AuditLogRow & {
  actorName: string | null;
};

export type AuditLogListData = {
  items: AdminAuditLogItem[];
  total: number;
  page: number;
  totalPages: number;
};

export function buildAuditHref(filters: AuditLogFilters): string {
  const params = new URLSearchParams();
  const entries: Array<[keyof AuditLogFilters, string | undefined]> = [
    ["q", filters.q],
    ["actor", filters.actor],
    ["action", filters.action],
    ["entity", filters.entity],
    ["from", filters.from],
    ["to", filters.to],
    ["sort", filters.sort],
    ["page", filters.page],
  ];
  for (const [key, value] of entries) {
    if (value && value !== "1" && !(key === "sort" && value === "desc")) {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return query ? `/admin/audit-logs?${query}` : "/admin/audit-logs";
}

/**
 * Keys that may carry secrets/tokens inside stored JSON payloads. Any value
 * under one of these keys is masked before the payload is rendered.
 */
const SECRET_KEY_PATTERN =
  /(password|passwd|secret|token|api[_-]?key|authorization|auth|cookie|session|private[_-]?key|client[_-]?secret|access[_-]?key|refresh[_-]?token|credential)/i;

function redactJson(value: Json): Json {
  if (Array.isArray(value)) {
    return value.map((item) => redactJson(item));
  }
  if (value !== null && typeof value === "object") {
    const next: { [key: string]: Json | undefined } = {};
    for (const [key, item] of Object.entries(value)) {
      next[key] = SECRET_KEY_PATTERN.test(key) ? "*** REDACTED ***" : redactJson(item as Json);
    }
    return next;
  }
  return value;
}

/** Scrub secrets from a parsed JSON payload (deep, key-based). */
export function scrubAuditJson(value: unknown): unknown {
  return redactJson(value as Json);
}

/** Structured, redacted rendering of a stored JSON payload. */
export function formatAuditJson(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  return JSON.stringify(scrubAuditJson(value), null, 2);
}

/** Compact one-line presence summary used in the table row. */
export function auditJsonSummary(value: unknown, maxLength = 60): string {
  if (value === null || value === undefined) {
    return "—";
  }
  const singleLine = JSON.stringify(scrubAuditJson(value));
  if (!singleLine) {
    return "—";
  }
  return singleLine.length > maxLength
    ? `${singleLine.slice(0, maxLength)}…`
    : singleLine;
}

/** Human-friendly label for an action/entity string (keeps snake_case readable). */
export function formatAuditToken(value: string): string {
  return value.replace(/[_-]+/g, " ");
}
