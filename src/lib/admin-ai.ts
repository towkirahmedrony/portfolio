import { isUuid } from "@/lib/ai/sessions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  AI_ACTIVE_WINDOW_MS,
  AI_CONVERSATION_PAGE_SIZE,
  AI_RECENT_CONVERSATIONS_LIMIT,
  conversationStatus,
  isTruthySetting,
  parseAiConversationDateFilter,
  parseAiConversationFilter,
  type AdminAiConversationDetail,
  type AdminAiConversationListItem,
  type AdminAiConversationMessage,
  type AdminAiConversationPerson,
  type AdminAiOverviewStats,
  type AdminAiPaginated,
  type AdminAiPageFilters,
  type QueryResult,
} from "@/lib/admin-ai-constants";
import type {
  AiChatSessionRow,
  AiFaqRow,
  AiKnowledgeRow,
  AiRuleRow,
  AiSettingRow,
  ProfileRow,
} from "@/types/database";

export * from "@/lib/admin-ai-constants";

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

function startOfUtcDay(date = new Date()): string {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  ).toISOString();
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function escapeSearch(value: string): string {
  return value.replace(/[%_,()]/g, " ").trim();
}

function personName(
  profile: Pick<ProfileRow, "id" | "full_name" | "display_name"> | null,
): AdminAiConversationPerson | null {
  if (!profile) {
    return null;
  }
  return {
    id: profile.id,
    name: profile.display_name?.trim() || profile.full_name.trim() || "Logged-in user",
  };
}

type CountResult = {
  count: number | null;
  error: { message?: string; code?: string } | null;
};

function toCountResult(result: CountResult, table: string): QueryResult<number> {
  return toQueryResult(result.count ?? 0, result.error, table, (result.count ?? 0) === 0);
}

export async function getAdminAiOverview(): Promise<{
  stats: AdminAiOverviewStats;
  recent: QueryResult<AdminAiConversationListItem[]>;
}> {
  const supabase = await createServerSupabaseClient();
  const todayStart = startOfUtcDay();

  const [
    knowledgeTotal,
    knowledgeActive,
    rulesTotal,
    faqsActive,
    enabledSetting,
    conversationsTotal,
    conversationsToday,
    messagesToday,
    recentSessions,
  ] = await Promise.all([
    supabase.from("ai_knowledge").select("id", { count: "exact", head: true }),
    supabase
      .from("ai_knowledge")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    supabase.from("ai_rules").select("id", { count: "exact", head: true }),
    supabase.from("ai_faqs").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase
      .from("ai_settings")
      .select("setting_key,setting_value,is_active")
      .eq("setting_key", "enabled")
      .maybeSingle(),
    supabase.from("ai_chat_sessions").select("id", { count: "exact", head: true }),
    supabase
      .from("ai_chat_sessions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart),
    supabase
      .from("ai_chat_messages")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart),
    supabase
      .from("ai_chat_sessions")
      .select("id, title, user_id, visitor_id, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(AI_RECENT_CONVERSATIONS_LIMIT),
  ]);

  let aiEnabled: QueryResult<boolean | null>;
  if (enabledSetting.error) {
    aiEnabled = toQueryResult(null, enabledSetting.error, "ai_settings", true);
  } else if (!enabledSetting.data) {
    aiEnabled = { status: "empty", data: null };
  } else {
    const row = enabledSetting.data as Pick<AiSettingRow, "setting_value" | "is_active">;
    aiEnabled = {
      status: "ok",
      data: row.is_active !== false && isTruthySetting(row.setting_value),
    };
  }

  const stats: AdminAiOverviewStats = {
    knowledgeTotal: toCountResult(knowledgeTotal, "ai_knowledge"),
    knowledgeActive: toCountResult(knowledgeActive, "ai_knowledge"),
    rulesTotal: toCountResult(rulesTotal, "ai_rules"),
    faqsActive: toCountResult(faqsActive, "ai_faqs"),
    aiEnabled,
    conversationsTotal: toCountResult(conversationsTotal, "ai_chat_sessions"),
    conversationsToday: toCountResult(conversationsToday, "ai_chat_sessions"),
    messagesToday: toCountResult(messagesToday, "ai_chat_messages"),
  };

  if (recentSessions.error) {
    return {
      stats,
      recent: toQueryResult([], recentSessions.error, "ai_chat_sessions", true),
    };
  }

  const rows = (recentSessions.data ?? []) as AiChatSessionRow[];
  const items = await enrichConversationRows(rows);
  return {
    stats,
    recent: toQueryResult(items, null, "ai_chat_sessions", items.length === 0),
  };
}

async function enrichConversationRows(
  rows: AiChatSessionRow[],
): Promise<AdminAiConversationListItem[]> {
  if (rows.length === 0) {
    return [];
  }

  const supabase = await createServerSupabaseClient();
  const sessionIds = rows.map((row) => row.id);
  const userIds = [
    ...new Set(rows.map((row) => row.user_id).filter((id): id is string => Boolean(id))),
  ];

  const [countPairs, previewPairs, profilesResult] = await Promise.all([
    Promise.all(
      sessionIds.map(async (id) => {
        const { count } = await supabase
          .from("ai_chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("session_id", id);
        return [id, count ?? 0] as const;
      }),
    ),
    Promise.all(
      sessionIds.map(async (id) => {
        const { data } = await supabase
          .from("ai_chat_messages")
          .select("content")
          .eq("session_id", id)
          .eq("role", "user")
          .order("created_at", { ascending: true })
          .limit(1);
        const content = (data?.[0] as { content?: string } | undefined)?.content?.trim() ?? "";
        return [id, content] as const;
      }),
    ),
    userIds.length > 0
      ? supabase.from("profiles").select("id, full_name, display_name").in("id", userIds)
      : Promise.resolve({ data: [] as Pick<ProfileRow, "id" | "full_name" | "display_name">[] }),
  ]);

  const counts = new Map<string, number>(countPairs);
  const previews = new Map<string, string>(
    previewPairs.filter(([, content]) => content.length > 0),
  );

  const profiles = new Map<string, AdminAiConversationPerson>();
  for (const profile of (profilesResult.data ?? []) as Pick<
    ProfileRow,
    "id" | "full_name" | "display_name"
  >[]) {
    const person = personName(profile);
    if (person) {
      profiles.set(profile.id, person);
    }
  }

  return rows.map((row) => {
    const isAnonymous = !row.user_id;
    return {
      id: row.id,
      title: row.title,
      preview: previews.get(row.id) ?? row.title,
      userId: row.user_id,
      isAnonymous,
      user: row.user_id ? (profiles.get(row.user_id) ?? null) : null,
      messageCount: counts.get(row.id) ?? 0,
      createdAt: row.created_at,
      lastActivity: row.updated_at,
      status: conversationStatus(row.updated_at),
    };
  });
}

export async function getAdminAiKnowledge(): Promise<QueryResult<AiKnowledgeRow[]>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("ai_knowledge")
    .select("*")
    .order("priority", { ascending: false })
    .order("updated_at", { ascending: false });
  const rows = (data ?? []) as AiKnowledgeRow[];
  return toQueryResult(rows, error, "ai_knowledge", rows.length === 0);
}

export async function getAdminAiRules(): Promise<QueryResult<AiRuleRow[]>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("ai_rules")
    .select("*")
    .order("priority", { ascending: false })
    .order("updated_at", { ascending: false });
  const rows = (data ?? []) as AiRuleRow[];
  return toQueryResult(rows, error, "ai_rules", rows.length === 0);
}

export async function getAdminAiFaqs(): Promise<QueryResult<AiFaqRow[]>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("ai_faqs")
    .select("*")
    .order("priority", { ascending: false })
    .order("updated_at", { ascending: false });
  const rows = (data ?? []) as AiFaqRow[];
  return toQueryResult(rows, error, "ai_faqs", rows.length === 0);
}

export async function getAdminAiSettings(): Promise<QueryResult<AiSettingRow[]>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("ai_settings")
    .select("*")
    .order("setting_key", { ascending: true });
  const rows = (data ?? []) as AiSettingRow[];
  return toQueryResult(rows, error, "ai_settings", rows.length === 0);
}

export async function getAdminAiConversations(
  filters: AdminAiPageFilters,
): Promise<QueryResult<AdminAiPaginated<AdminAiConversationListItem>>> {
  const supabase = await createServerSupabaseClient();
  const search = escapeSearch(filters.q ?? "");
  const filter = parseAiConversationFilter(filters.filter);
  const date = parseAiConversationDateFilter(filters.date);
  const requestedPage = Math.max(1, Number.parseInt(filters.page ?? "1", 10) || 1);

  let matchingIds: string[] | null = null;
  if (search) {
    const orSession = isUuid(search)
      ? `id.eq.${search},user_id.eq.${search},title.ilike.%${search}%`
      : `title.ilike.%${search}%`;
    const [sessionMatches, messageMatches] = await Promise.all([
      supabase.from("ai_chat_sessions").select("id").or(orSession),
      supabase.from("ai_chat_messages").select("session_id").ilike("content", `%${search}%`).limit(200),
    ]);

    if (sessionMatches.error) {
      return toQueryResult(
        { items: [], total: 0, page: 1, totalPages: 1 },
        sessionMatches.error,
        "ai_chat_sessions",
        true,
      );
    }

    const ids = new Set<string>();
    for (const row of (sessionMatches.data ?? []) as { id: string }[]) {
      ids.add(row.id);
    }
    for (const row of (messageMatches.data ?? []) as { session_id: string }[]) {
      ids.add(row.session_id);
    }
    matchingIds = [...ids];
    if (matchingIds.length === 0) {
      return {
        status: "empty",
        data: { items: [], total: 0, page: 1, totalPages: 1 },
      };
    }
  }

  let query = supabase
    .from("ai_chat_sessions")
    .select("id, title, user_id, visitor_id, created_at, updated_at", { count: "exact" })
    .order("updated_at", { ascending: false });

  if (matchingIds) {
    query = query.in("id", matchingIds);
  }
  if (filter === "anonymous") {
    query = query.is("user_id", null);
  } else if (filter === "logged_in") {
    query = query.not("user_id", "is", null);
  } else if (filter === "active") {
    query = query.gte("updated_at", new Date(Date.now() - AI_ACTIVE_WINDOW_MS).toISOString());
  } else if (filter === "closed") {
    query = query.lt("updated_at", new Date(Date.now() - AI_ACTIVE_WINDOW_MS).toISOString());
  } else if (filter === "recent") {
    query = query.gte("updated_at", daysAgoIso(7));
  }

  if (date === "today") {
    query = query.gte("updated_at", startOfUtcDay());
  } else if (date === "7d") {
    query = query.gte("updated_at", daysAgoIso(7));
  } else if (date === "30d") {
    query = query.gte("updated_at", daysAgoIso(30));
  }

  const from = (requestedPage - 1) * AI_CONVERSATION_PAGE_SIZE;
  const to = from + AI_CONVERSATION_PAGE_SIZE - 1;
  const { data, error, count } = await query.range(from, to);

  if (error) {
    return toQueryResult(
      { items: [], total: 0, page: 1, totalPages: 1 },
      error,
      "ai_chat_sessions",
      true,
    );
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / AI_CONVERSATION_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const rows = (data ?? []) as AiChatSessionRow[];
  const items = await enrichConversationRows(rows);

  return toQueryResult(
    { items, total, page, totalPages },
    null,
    "ai_chat_sessions",
    items.length === 0,
  );
}

export async function getAdminAiConversationDetail(
  sessionId: string,
): Promise<QueryResult<AdminAiConversationDetail>> {
  const emptyDetail = (): AdminAiConversationDetail => ({
    session: {
      id: sessionId,
      title: null,
      user_id: null,
      visitor_id: null,
      created_at: "",
      updated_at: "",
    },
    isAnonymous: true,
    user: null,
    status: "closed",
    messageCount: 0,
    messages: [],
  });

  if (!isUuid(sessionId)) {
    return { status: "empty", data: emptyDetail() };
  }

  const supabase = await createServerSupabaseClient();
  const { data: session, error: sessionError } = await supabase
    .from("ai_chat_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) {
    return toQueryResult(emptyDetail(), sessionError, "ai_chat_sessions", true);
  }

  if (!session) {
    return { status: "empty", data: emptyDetail() };
  }

  const row = session as AiChatSessionRow;
  const [{ data: messages, error: messageError }, profileResult] = await Promise.all([
    supabase
      .from("ai_chat_messages")
      .select("id, role, content, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true }),
    row.user_id
      ? supabase
          .from("profiles")
          .select("id, full_name, display_name")
          .eq("id", row.user_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (messageError) {
    return toQueryResult(
      {
        session: row,
        isAnonymous: !row.user_id,
        user: null,
        status: conversationStatus(row.updated_at),
        messageCount: 0,
        messages: [],
      },
      messageError,
      "ai_chat_messages",
      true,
    );
  }

  const history = ((messages ?? []) as AdminAiConversationMessage[]).filter(
    (message) => message.role === "user" || message.role === "assistant",
  );

  return {
    status: "ok",
    data: {
      session: row,
      isAnonymous: !row.user_id,
      user: personName(
        (profileResult.data ?? null) as Pick<
          ProfileRow,
          "id" | "full_name" | "display_name"
        > | null,
      ),
      status: conversationStatus(row.updated_at),
      messageCount: history.length,
      messages: history,
    },
  };
}
