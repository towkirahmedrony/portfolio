import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiCta, AiChatMessage, AiMessageRole } from "@/types/ai";
import type {
  AiChatMessageRow,
  AiChatSessionRow,
  Database,
  Json,
} from "@/types/database";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID_PATTERN.test(value));
}

export function titleFromMessage(message: string): string {
  const compact = message.replace(/\s+/g, " ").trim();
  if (compact.length === 0) {
    return "New conversation";
  }
  if (compact.length <= 80) {
    return compact;
  }
  return `${compact.slice(0, 77)}...`;
}

function asCta(value: Json | null | undefined): AiCta | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as {
    label?: unknown;
    href?: unknown;
    reason?: unknown;
    cta?: unknown;
  };
  const source =
    record.cta && typeof record.cta === "object" && !Array.isArray(record.cta)
      ? (record.cta as { label?: unknown; href?: unknown; reason?: unknown })
      : record;

  if (typeof source.label !== "string" || typeof source.href !== "string") {
    return null;
  }

  const label = source.label.trim();
  const href = source.href.trim();
  if (!label || !href.startsWith("/") || href.startsWith("//")) {
    return null;
  }

  return {
    label,
    href,
    reason:
      typeof source.reason === "string" && source.reason.trim().length > 0
        ? source.reason.trim()
        : null,
  };
}

function ctaToJson(cta: AiCta | null | undefined): Json | null {
  if (!cta) {
    return null;
  }

  return {
    label: cta.label,
    href: cta.href,
    reason: cta.reason,
  };
}

export function toPublicMessage(row: AiChatMessageRow): AiChatMessage | null {
  if (row.role !== "user" && row.role !== "assistant") {
    return null;
  }

  return {
    id: row.id,
    role: row.role as AiMessageRole,
    content: row.content,
    createdAt: row.created_at,
    cta: asCta(row.cta) ?? asCta(row.metadata),
  };
}

export async function loadOwnedSession(
  supabase: SupabaseClient<Database>,
  input: {
    sessionId: string;
    userId: string | null;
    visitorId: string;
  },
): Promise<AiChatSessionRow | null> {
  const { data, error } = await supabase
    .from("ai_chat_sessions")
    .select("*")
    .eq("id", input.sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Could not load chat session.");
  }

  if (!data) {
    return null;
  }

  const session = data as AiChatSessionRow;
  if (input.userId) {
    if (session.user_id && session.user_id !== input.userId) {
      return null;
    }
    if (!session.user_id && session.visitor_id && session.visitor_id !== input.visitorId) {
      return null;
    }
    return session;
  }

  if (session.user_id) {
    return null;
  }

  return session.visitor_id === input.visitorId ? session : null;
}

export async function createChatSession(
  supabase: SupabaseClient<Database>,
  input: {
    userId: string | null;
    visitorId: string;
    title: string;
  },
): Promise<AiChatSessionRow> {
  const now = new Date().toISOString();
  const row: AiChatSessionRow = {
    id: crypto.randomUUID(),
    user_id: input.userId,
    visitor_id: input.userId ? null : input.visitorId,
    title: input.title,
    created_at: now,
    updated_at: now,
  };

  const fullInsert = await supabase.from("ai_chat_sessions").insert(row);
  if (!fullInsert.error) {
    return row;
  }

  const fallback = await supabase.from("ai_chat_sessions").insert({
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
  if (fallback.error) {
    throw new Error(
      fullInsert.error?.message || fallback.error?.message || "Could not create chat session.",
    );
  }

  return { ...row, visitor_id: null };
}

export async function claimSessionIfNeeded(
  supabase: SupabaseClient<Database>,
  session: AiChatSessionRow,
  userId: string | null,
): Promise<AiChatSessionRow> {
  if (!userId || session.user_id === userId) {
    return session;
  }

  const { data, error } = await supabase
    .from("ai_chat_sessions")
    .update({
      user_id: userId,
      visitor_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id)
    .select("*")
    .single();

  if (error || !data) {
    return session;
  }

  return data as AiChatSessionRow;
}

export async function touchSession(
  supabase: SupabaseClient<Database>,
  sessionId: string,
): Promise<void> {
  await supabase
    .from("ai_chat_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", sessionId);
}

export async function insertChatMessage(
  supabase: SupabaseClient<Database>,
  input: {
    sessionId: string;
    role: AiMessageRole;
    content: string;
    cta?: AiCta | null;
    /**
     * Extra bookkeeping stored in the existing `metadata` jsonb column (used
     * for the Dify conversation id). Never exposed to the client through
     * toPublicMessage.
     */
    metadata?: Record<string, Json>;
  },
): Promise<AiChatMessageRow> {
  const ctaJson = ctaToJson(input.cta);
  const now = new Date().toISOString();
  const row: AiChatMessageRow = {
    id: crypto.randomUUID(),
    session_id: input.sessionId,
    role: input.role,
    content: input.content,
    created_at: now,
    cta: ctaJson,
    metadata: { ...(input.metadata ?? {}), ...(ctaJson ? { cta: ctaJson } : {}) },
  };

  const withMeta = await supabase.from("ai_chat_messages").insert(row);

  if (!withMeta.error) {
    return row;
  }

  const core = await supabase.from("ai_chat_messages").insert({
    id: row.id,
    session_id: row.session_id,
    role: row.role,
    content: row.content,
    created_at: row.created_at,
  });

  if (core.error) {
    throw new Error(
      withMeta.error?.message || core.error?.message || "Could not save chat message.",
    );
  }

  return { ...row, cta: null, metadata: {} };
}

export async function listSessionMessages(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  limit: number,
): Promise<AiChatMessageRow[]> {
  const { data, error } = await supabase
    .from("ai_chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as AiChatMessageRow[]).slice().reverse();
}

/**
 * Deletes one website-side conversation. `ai_chat_messages.session_id` is
 * declared `on delete cascade`, so the messages go with the session — no orphan
 * history, no extra statement, and no schema change.
 */
export async function deleteChatSession(
  supabase: SupabaseClient<Database>,
  sessionId: string,
): Promise<void> {
  const { error } = await supabase.from("ai_chat_sessions").delete().eq("id", sessionId);

  if (error) {
    throw new Error(error.message || "Could not delete that conversation.");
  }
}
