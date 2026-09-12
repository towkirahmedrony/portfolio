import type { QueryResult } from "@/lib/admin-project-constants";
import type {
  AiChatMessageRow,
  AiChatSessionRow,
  AiFaqRow,
  AiKnowledgeRow,
  AiRuleRow,
  AiSettingRow,
} from "@/types/database";

export { formatDate, formatDateTime } from "@/lib/admin-project-constants";
export type { QueryResult };

export const AI_ADMIN_TABS = [
  "overview",
  "knowledge",
  "rules",
  "faqs",
  "settings",
  "conversations",
] as const;

export type AdminAiTab = (typeof AI_ADMIN_TABS)[number];

export const AI_TAB_LABELS: Record<AdminAiTab, string> = {
  overview: "Overview",
  knowledge: "Knowledge",
  rules: "Rules",
  faqs: "FAQs",
  settings: "Settings",
  conversations: "Conversations",
};

export const AI_CONVERSATION_PAGE_SIZE = 25;
export const AI_RECENT_CONVERSATIONS_LIMIT = 8;
export const AI_ACTIVE_WINDOW_MS = 24 * 60 * 60 * 1000;

export const AI_CONVERSATION_FILTERS = [
  "all",
  "anonymous",
  "logged_in",
  "active",
  "closed",
  "recent",
] as const;

export type AiConversationFilter = (typeof AI_CONVERSATION_FILTERS)[number];

export const AI_CONVERSATION_FILTER_LABELS: Record<AiConversationFilter, string> = {
  all: "All",
  anonymous: "Anonymous",
  logged_in: "Logged-in",
  active: "Active",
  closed: "Closed",
  recent: "Recent activity",
};

export const AI_CONVERSATION_DATE_FILTERS = ["all", "today", "7d", "30d"] as const;

export type AiConversationDateFilter = (typeof AI_CONVERSATION_DATE_FILTERS)[number];

export const AI_CONVERSATION_DATE_LABELS: Record<AiConversationDateFilter, string> = {
  all: "All",
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
};

export const AI_RULE_TYPE_SUGGESTIONS = [
  "safety",
  "behavior",
  "cta",
  "tone",
  "policy",
  "style",
] as const;

export const AI_KNOWLEDGE_CATEGORY_SUGGESTIONS = [
  "business",
  "services",
  "pricing",
  "process",
  "portfolio",
  "general",
] as const;

export const AI_FAQ_CATEGORY_SUGGESTIONS = [
  "general",
  "pricing",
  "process",
  "services",
  "timeline",
] as const;

export type AiSettingFieldKind = "text" | "textarea" | "boolean" | "select";

export type AiSettingFieldSpec = {
  label: string;
  kind: AiSettingFieldKind;
  options?: readonly string[];
  help?: string;
};

export const AI_SETTING_FIELD_SPECS: Record<string, AiSettingFieldSpec> = {
  assistant_name: { label: "Assistant name", kind: "text" },
  business_focus: { label: "Business focus", kind: "textarea" },
  response_language: {
    label: "Response language",
    kind: "select",
    options: ["English", "Bengali", "Bangla", "English and Bengali"],
  },
  response_style: {
    label: "Response style",
    kind: "select",
    options: [
      "professional",
      "friendly",
      "concise",
      "professional, clear, and concise",
    ],
  },
  pricing_policy: { label: "Pricing policy", kind: "textarea" },
  unknown_answer_policy: { label: "Unknown answer policy", kind: "textarea" },
  primary_cta: { label: "Primary CTA", kind: "text" },
  project_cta: { label: "Project CTA", kind: "text" },
  contact_cta: { label: "Contact CTA", kind: "text" },
  knowledge_source_priority: {
    label: "Knowledge source priority",
    kind: "text",
    help: "Existing database value. Do not invent a new order unless you mean to change Nora's sources.",
  },
  enabled: { label: "AI enabled", kind: "boolean" },
  tone: { label: "Tone", kind: "textarea" },
  cta_label: { label: "CTA label", kind: "text" },
  cta_href: { label: "CTA href", kind: "text" },
  max_history_messages: { label: "Max history messages", kind: "text" },
};

export const BOOLEAN_SETTING_KEYS = new Set(["enabled"]);

export type AdminAiPageFilters = {
  tab?: string;
  q?: string;
  filter?: string;
  date?: string;
  page?: string;
  session?: string;
  edit?: string;
  new?: string;
};

export type AdminAiConversationStatus = "active" | "closed";

export type AdminAiConversationPerson = {
  id: string;
  name: string;
};

export type AdminAiConversationListItem = {
  id: string;
  title: string | null;
  preview: string | null;
  userId: string | null;
  isAnonymous: boolean;
  user: AdminAiConversationPerson | null;
  messageCount: number;
  createdAt: string;
  lastActivity: string;
  status: AdminAiConversationStatus;
};

export type AdminAiConversationMessage = Pick<
  AiChatMessageRow,
  "id" | "role" | "content" | "created_at"
>;

export type AdminAiConversationDetail = {
  session: AiChatSessionRow;
  isAnonymous: boolean;
  user: AdminAiConversationPerson | null;
  status: AdminAiConversationStatus;
  messageCount: number;
  messages: AdminAiConversationMessage[];
};

export type AdminAiOverviewStats = {
  knowledgeTotal: QueryResult<number>;
  knowledgeActive: QueryResult<number>;
  rulesTotal: QueryResult<number>;
  faqsActive: QueryResult<number>;
  aiEnabled: QueryResult<boolean | null>;
  conversationsTotal: QueryResult<number>;
  conversationsToday: QueryResult<number>;
  messagesToday: QueryResult<number>;
};

export type AdminAiPaginated<T> = {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
};

export type { AiFaqRow, AiKnowledgeRow, AiRuleRow, AiSettingRow };

export function isAdminAiTab(value: string | undefined): value is AdminAiTab {
  return AI_ADMIN_TABS.includes((value ?? "") as AdminAiTab);
}

export function parseAdminAiTab(value: string | undefined): AdminAiTab {
  return isAdminAiTab(value) ? value : "overview";
}

export function isAiConversationFilter(
  value: string | undefined,
): value is AiConversationFilter {
  return AI_CONVERSATION_FILTERS.includes((value ?? "") as AiConversationFilter);
}

export function parseAiConversationFilter(
  value: string | undefined,
): AiConversationFilter {
  return isAiConversationFilter(value) ? value : "all";
}

export function isAiConversationDateFilter(
  value: string | undefined,
): value is AiConversationDateFilter {
  return AI_CONVERSATION_DATE_FILTERS.includes(
    (value ?? "") as AiConversationDateFilter,
  );
}

export function parseAiConversationDateFilter(
  value: string | undefined,
): AiConversationDateFilter {
  return isAiConversationDateFilter(value) ? value : "all";
}

export function conversationStatus(updatedAt: string, now = Date.now()): AdminAiConversationStatus {
  const time = new Date(updatedAt).getTime();
  if (!Number.isFinite(time)) {
    return "closed";
  }
  return now - time <= AI_ACTIVE_WINDOW_MS ? "active" : "closed";
}

export function shortSessionId(id: string): string {
  return id.slice(0, 8);
}

export function settingLabel(key: string): string {
  const spec = AI_SETTING_FIELD_SPECS[key];
  if (spec) {
    return spec.label;
  }
  return key.replace(/_/g, " ");
}

export function settingFieldSpec(key: string, value: string | null): AiSettingFieldSpec {
  const known = AI_SETTING_FIELD_SPECS[key];
  if (known) {
    return known;
  }
  const raw = value ?? "";
  if (BOOLEAN_SETTING_KEYS.has(key) || /^(true|false|0|1|on|off)$/i.test(raw.trim())) {
    return { label: settingLabel(key), kind: "boolean" };
  }
  if (raw.includes("\n") || raw.length > 80) {
    return { label: settingLabel(key), kind: "textarea" };
  }
  return { label: settingLabel(key), kind: "text" };
}

export function isTruthySetting(value: string | null | undefined): boolean {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "on" || normalized === "yes";
}

export function parseKeywordsInput(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatKeywords(keywords: string[] | null | undefined): string {
  return (keywords ?? []).join(", ");
}

export function buildAdminAiHref(filters: AdminAiPageFilters): string {
  const params = new URLSearchParams();
  const tab = parseAdminAiTab(filters.tab);
  if (tab !== "overview") params.set("tab", tab);
  if (filters.q) params.set("q", filters.q);
  if (filters.filter && filters.filter !== "all") params.set("filter", filters.filter);
  if (filters.date && filters.date !== "all") params.set("date", filters.date);
  if (filters.page && filters.page !== "1") params.set("page", filters.page);
  if (filters.session) params.set("session", filters.session);
  if (filters.edit) params.set("edit", filters.edit);
  if (filters.new === "1") params.set("new", "1");
  const query = params.toString();
  return query ? `/admin/ai?${query}` : "/admin/ai";
}
