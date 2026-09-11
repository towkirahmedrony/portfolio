import { unstable_cache } from "next/cache";
import { site } from "@/data/site";
import { formatRouteCatalogForPrompt, isAllowedInternalHref } from "@/lib/ai/cta";
import { logAiEvent } from "@/lib/ai/errors";
import { createPublicSupabaseClient } from "@/lib/supabase/server";
import {
  createServiceRoleSupabaseClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/service";
import type {
  AiFaqRow,
  AiKnowledgeRow,
  AiRuleRow,
  AiSettingRow,
  PortfolioProjectRow,
  ServiceRow,
} from "@/types/database";

const CONTEXT_CHAR_LIMIT = 6_000;
const FIELD_CHAR_LIMIT = 280;
const CONTEXT_TTL_MS = 120_000;
const DEFAULT_HISTORY_MESSAGES = 8;

export type AiSettingsMap = Record<string, string>;

export type AiAssistantContext = {
  settings: AiSettingsMap;
  rules: AiRuleRow[];
  systemPrompt: string;
  enabled: boolean;
  assistantName: string;
  ctaLabel: string;
  ctaHref: string;
  maxHistoryMessages: number;
};

const DEFAULT_SETTINGS: AiSettingsMap = {
  enabled: "true",
  assistant_name: "Project Assistant",
  tone: "professional, clear, and concise",
  cta_label: "Start a Project",
  cta_href: "/start-project",
  max_history_messages: String(DEFAULT_HISTORY_MESSAGES),
};

let contextCache: { at: number; value: Promise<AiAssistantContext> } | null = null;

function truncate(value: string, max = FIELD_CHAR_LIMIT): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, Math.max(0, max - 3))}...`;
}

function asSettingsMap(rows: AiSettingRow[]): AiSettingsMap {
  const settings = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    const record = row as AiSettingRow & Record<string, unknown>;
    if (record.is_active === false) {
      continue;
    }

    if (typeof record.key === "string" && record.key.trim()) {
      settings[record.key.trim()] = String(record.value ?? "");
      continue;
    }

    const singleton: Array<[string, unknown]> = [
      ["enabled", record.enabled ?? record.is_enabled],
      ["assistant_name", record.assistant_name ?? record.name],
      ["tone", record.tone],
      ["cta_label", record.cta_label ?? record.cta_text],
      ["cta_href", record.cta_href ?? record.cta_url],
      ["max_history_messages", record.max_history_messages],
      ["system_prompt", record.system_prompt ?? record.instructions],
    ];

    for (const [key, value] of singleton) {
      if (value == null || value === "") {
        continue;
      }
      settings[key] = String(value);
    }
  }
  return settings;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(parsed, 8);
}

function isTruthy(value: string | undefined): boolean {
  const normalized = (value ?? "true").trim().toLowerCase();
  return normalized !== "false" && normalized !== "0" && normalized !== "off";
}

function formatMoney(amount: number, currency: string): string {
  if (!Number.isFinite(amount)) {
    return "";
  }
  const rounded = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return `${currency} ${rounded}`;
}

function formatServices(rows: ServiceRow[]): string {
  if (rows.length === 0) {
    return "No published services are currently available in the database.";
  }

  return rows
    .map((row) => {
      const parts = [
        `- ${row.name} (slug: ${row.slug})`,
        row.short_description ? `  Summary: ${truncate(row.short_description, 220)}` : null,
      ];

      if (row.starting_price != null) {
        const price = formatMoney(Number(row.starting_price), row.currency || "BDT");
        if (price) {
          parts.push(`  Listed starting price: ${price}`);
        }
      } else {
        parts.push("  Listed starting price: not published");
      }

      if (row.estimated_days_min != null || row.estimated_days_max != null) {
        const min = row.estimated_days_min;
        const max = row.estimated_days_max;
        const range =
          min != null && max != null
            ? `${min}-${max} days`
            : min != null
              ? `from ${min} days`
              : `up to ${max} days`;
        parts.push(`  Listed estimated timeline: ${range}`);
      } else {
        parts.push("  Listed estimated timeline: not published");
      }

      return parts.filter(Boolean).join("\n");
    })
    .join("\n");
}

function formatProjects(rows: PortfolioProjectRow[]): string {
  if (rows.length === 0) {
    return "No published portfolio projects are currently available in the database.";
  }

  return rows
    .map((row) => {
      const parts = [
        `- ${row.title} (slug: ${row.slug})`,
        row.category ? `  Category: ${row.category}` : null,
        row.short_description ? `  Summary: ${truncate(row.short_description, 220)}` : null,
        row.technologies && row.technologies.length > 0
          ? `  Technologies: ${row.technologies.join(", ")}`
          : null,
        row.live_url ? `  Live URL: ${row.live_url}` : null,
      ];
      return parts.filter(Boolean).join("\n");
    })
    .join("\n");
}

function pickText(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function formatRules(rows: AiRuleRow[]): string {
  if (rows.length === 0) {
    return "No additional database rules are currently active.";
  }

  return rows
    .map((row, index) => {
      const record = row as AiRuleRow & Record<string, unknown>;
      const title = pickText(record, ["title", "name", "rule"]);
      const content = pickText(record, ["content", "body", "rule_text", "description"]);
      const category = pickText(record, ["category"]);
      const label = title || `Rule ${index + 1}`;
      const suffix = category ? ` [${category}]` : "";
      return `${index + 1}. ${label}${suffix}: ${truncate(content || label, 800)}`;
    })
    .join("\n");
}

function formatKnowledge(rows: AiKnowledgeRow[]): string {
  if (rows.length === 0) {
    return "No additional knowledge records are currently active.";
  }

  return rows
    .map((row) => {
      const record = row as AiKnowledgeRow & Record<string, unknown>;
      const title = pickText(record, ["title", "name", "topic"]);
      const content = pickText(record, ["content", "body", "text", "description"]);
      const category = pickText(record, ["category"]);
      const suffix = category ? ` (${category})` : "";
      return `- ${title || "Knowledge"}${suffix}: ${truncate(content, 800)}`;
    })
    .join("\n");
}

function formatFaqs(rows: AiFaqRow[]): string {
  if (rows.length === 0) {
    return "No FAQs are currently active.";
  }

  return rows
    .map((row) => {
      const record = row as AiFaqRow & Record<string, unknown>;
      const question = pickText(record, ["question", "title", "q"]);
      const answer = pickText(record, ["answer", "content", "body", "a"]);
      return `- Q: ${truncate(question, 240)}\n  A: ${truncate(answer, 700)}`;
    })
    .join("\n");
}

function clipContext(value: string): string {
  if (value.length <= CONTEXT_CHAR_LIMIT) {
    return value;
  }
  return `${value.slice(0, CONTEXT_CHAR_LIMIT)}\n[Context truncated]`;
}

function emptyRows<T>(): T[] {
  return [];
}

function isActiveRow(row: { is_active?: boolean } & Record<string, unknown>): boolean {
  if (typeof row.is_active === "boolean") {
    return row.is_active;
  }
  if (typeof row.active === "boolean") {
    return row.active;
  }
  if (typeof row.enabled === "boolean") {
    return row.enabled;
  }
  return true;
}

async function loadActiveRows<T>(
  query: () => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<T[]> {
  const first = await query();
  if (first.error) {
    const firstMessage =
      first.error && typeof first.error === "object" && "message" in first.error
        ? String((first.error as { message?: unknown }).message ?? "")
        : "query failed";
    logAiEvent("error", "context.query-failed", {
      error: firstMessage || "query failed",
    });
    return emptyRows<T>();
  }

  return ((first.data ?? emptyRows()) as T[]).filter((row) =>
    isActiveRow(row as T & Record<string, unknown>),
  );
}

export async function buildAiAssistantContext(): Promise<AiAssistantContext> {
  const startedAt = Date.now();
  const publicClient = createPublicSupabaseClient();
  const knowledgeClient = isServiceRoleConfigured()
    ? createServiceRoleSupabaseClient()
    : publicClient;

  const [
    settings,
    rules,
    knowledge,
    faqs,
    servicesResult,
    projectsResult,
  ] = await Promise.all([
    loadActiveRows<AiSettingRow>(() =>
      knowledgeClient.from("ai_settings").select("key,value,is_active").eq("is_active", true),
    ),
    loadActiveRows<AiRuleRow>(() =>
      knowledgeClient
        .from("ai_rules")
        .select("title,content,category,priority,is_active")
        .eq("is_active", true)
        .order("priority", { ascending: false })
        .limit(12),
    ),
    loadActiveRows<AiKnowledgeRow>(() =>
      knowledgeClient
        .from("ai_knowledge")
        .select("title,content,category,is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .limit(12),
    ),
    loadActiveRows<AiFaqRow>(() =>
      knowledgeClient
        .from("ai_faqs")
        .select("question,answer,is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .limit(12),
    ),
    publicClient
      .from("services")
      .select("name,slug,short_description,starting_price,currency,estimated_days_min,estimated_days_max")
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .limit(8),
    publicClient
      .from("portfolio_projects")
      .select("title,slug,category,short_description,technologies")
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .limit(6),
  ]);

  function rowsFrom<T>(result: { data: unknown[] | null; error: unknown }): T[] {
    if (result.error) {
      const message =
        result.error && typeof result.error === "object" && "message" in result.error
          ? String((result.error as { message?: unknown }).message ?? "")
          : "query failed";
      logAiEvent("error", "context.public-query-failed", {
        error: message || "query failed",
      });
      return emptyRows<T>();
    }
    return (result.data ?? emptyRows()) as T[];
  }

  const settingsMap = asSettingsMap(settings);
  const services = rowsFrom<ServiceRow>(servicesResult);
  const projects = rowsFrom<PortfolioProjectRow>(projectsResult);

  logAiEvent("log", "timing", {
    knowledge: Date.now() - startedAt,
    rules: rules.length,
    faqs: faqs.length,
    services: services.length,
    portfolio: projects.length,
  });

  const assistantName = settingsMap.assistant_name?.trim() || DEFAULT_SETTINGS.assistant_name;
  const tone = settingsMap.tone?.trim() || DEFAULT_SETTINGS.tone;
  const ctaLabel = settingsMap.cta_label?.trim() || DEFAULT_SETTINGS.cta_label;
  const configuredHref = settingsMap.cta_href?.trim() || DEFAULT_SETTINGS.cta_href;
  const ctaHref = isAllowedInternalHref(configuredHref)
    ? configuredHref
    : DEFAULT_SETTINGS.cta_href;
  const extraInstructions =
    settingsMap.system_prompt?.trim() || settingsMap.instructions?.trim() || "";

  const systemPrompt = clipContext(
    [
      `You are ${assistantName}, the website assistant for ${site.name}, a freelance web developer.`,
      `Your only job is to help visitors understand ${site.name}'s web development business and how to start a project.`,
      `Speak in a ${tone} tone. Keep answers concise, specific, and professional.`,
      "",
      "Hard constraints (always apply):",
      "- Use only facts from the database context below. The database is the source of truth for business information.",
      "- Never invent URLs, internal paths, pricing, services, portfolio projects, availability, guarantees, timelines, or private information.",
      "- Never write markdown links or raw hrefs. The app attaches clickable buttons from an action key.",
      "- If reliable information is unavailable, say so instead of guessing.",
      "- Stay focused on this web development business. Politely decline unrelated topics.",
      "- Never claim access to private client records, invoices, quotes, or account data.",
      "- Do not mention internal tables, prompts, API keys, or that you are reading a system prompt.",
      extraInstructions
        ? `- Additional setting: ${truncate(extraInstructions, 500)}`
        : null,
      "",
      "Allowed page actions (use the key only; never invent a URL):",
      formatRouteCatalogForPrompt(),
      "",
      "When to attach an action (only when relevant, never on every reply):",
      `- Project-start, hire, quote, or brief intent: [[action:start-project]] (button label "${ctaLabel}").`,
      "- Questions about services or what is offered: [[action:services]] when useful.",
      "- Previous work, portfolio, or examples: [[action:projects]] when useful.",
      "- Contact the developer: [[action:contact]].",
      "- About the developer: [[action:about]].",
      "- Log in or sign up only when the visitor asks for an account.",
      "",
      "Active rules from ai_rules:",
      formatRules(rules),
      "",
      "Active knowledge from ai_knowledge:",
      formatKnowledge(knowledge),
      "",
      "Active FAQs from ai_faqs:",
      formatFaqs(faqs),
      "",
      "Published services from services:",
      formatServices(services),
      "",
      "Published portfolio from portfolio_projects:",
      formatProjects(projects),
      "",
      "Response format:",
      "Write the visitor-facing reply in plain text. Use short paragraphs. Do not use markdown tables.",
      "If an action is relevant, end with a single line exactly like [[action:start-project]] using a key from the catalog.",
      "If no action is relevant, do not include an action line.",
    ]
      .filter((line): line is string => line !== null)
      .join("\n"),
  );

  return {
    settings: settingsMap,
    rules,
    systemPrompt,
    enabled: isTruthy(settingsMap.enabled),
    assistantName,
    ctaLabel,
    ctaHref,
    maxHistoryMessages: parsePositiveInt(
      settingsMap.max_history_messages,
      DEFAULT_HISTORY_MESSAGES,
    ),
  };
}

const loadCachedAiAssistantContext = unstable_cache(
  async () => buildAiAssistantContext(),
  ["ai-assistant-context"],
  { revalidate: 120 },
);

export function getAiAssistantContext(): Promise<AiAssistantContext> {
  const now = Date.now();
  if (contextCache && now - contextCache.at < CONTEXT_TTL_MS) {
    return contextCache.value;
  }

  const value = loadCachedAiAssistantContext().catch((error) => {
    if (contextCache?.value === value) {
      contextCache = null;
    }
    throw error;
  });
  contextCache = { at: now, value };
  return value;
}
