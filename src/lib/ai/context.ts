import { site } from "@/data/site";
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
  OrderFormFieldRow,
  OrderFormOptionRow,
  OrderFormStepRow,
  PortfolioProjectRow,
  ServiceRow,
} from "@/types/database";

const CONTEXT_CHAR_LIMIT = 14_000;
const FIELD_CHAR_LIMIT = 600;

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
  max_history_messages: "20",
};

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
  return Math.min(parsed, 40);
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
        row.short_description ? `  Summary: ${truncate(row.short_description)}` : null,
        row.description ? `  Details: ${truncate(row.description)}` : null,
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
        row.short_description ? `  Summary: ${truncate(row.short_description)}` : null,
        row.description ? `  Details: ${truncate(row.description, 400)}` : null,
        row.technologies && row.technologies.length > 0
          ? `  Technologies: ${row.technologies.join(", ")}`
          : null,
        row.live_url ? `  Live URL: ${row.live_url}` : null,
      ];
      return parts.filter(Boolean).join("\n");
    })
    .join("\n");
}

function formatOrderForm(
  steps: OrderFormStepRow[],
  fields: OrderFormFieldRow[],
  options: OrderFormOptionRow[],
): string {
  if (steps.length === 0) {
    return "The Start a Project form structure is not currently available.";
  }

  const optionsByGroup = new Map<string, OrderFormOptionRow[]>();
  for (const option of options) {
    const list = optionsByGroup.get(option.group) ?? [];
    list.push(option);
    optionsByGroup.set(option.group, list);
  }

  const fieldsByStep = new Map<string, OrderFormFieldRow[]>();
  for (const field of fields) {
    const list = fieldsByStep.get(field.step_id) ?? [];
    list.push(field);
    fieldsByStep.set(field.step_id, list);
  }

  return steps
    .map((step) => {
      const stepFields = fieldsByStep.get(step.id) ?? [];
      const fieldLines = stepFields.map((field) => {
        const groupedOptions = field.options_group
          ? optionsByGroup.get(field.options_group)
          : undefined;
        const optionLabels = groupedOptions
          ? groupedOptions.map((option) => option.label).join(", ")
          : null;
        const required = field.required ? "required" : "optional";
        return [
          `  - ${field.label} (${field.input_type}, ${required})`,
          field.hint ? `    Hint: ${truncate(field.hint, 180)}` : null,
          optionLabels ? `    Options: ${truncate(optionLabels, 300)}` : null,
        ]
          .filter(Boolean)
          .join("\n");
      });

      return [
        `- Step: ${step.title}`,
        step.description ? `  ${truncate(step.description, 240)}` : null,
        ...fieldLines,
      ]
        .filter(Boolean)
        .join("\n");
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

async function loadActiveRows<T extends { is_active?: boolean }>(
  query: PromiseLike<{ data: T[] | null; error: unknown }>,
  fallback: PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const first = await query;
  if (!first.error) {
    return ((first.data ?? emptyRows()) as T[]).filter((row) =>
      isActiveRow(row as T & Record<string, unknown>),
    );
  }

  const second = await fallback;
  if (second.error) {
    return emptyRows<T>();
  }

  return ((second.data ?? emptyRows()) as T[]).filter((row) =>
    isActiveRow(row as T & Record<string, unknown>),
  );
}

export async function buildAiAssistantContext(): Promise<AiAssistantContext> {
  const publicClient = createPublicSupabaseClient();
  const serviceClient = isServiceRoleConfigured()
    ? createServiceRoleSupabaseClient()
    : null;

  const knowledgeClient = serviceClient ?? publicClient;

  const [
    settings,
    rules,
    knowledge,
    faqs,
    servicesResult,
    projectsResult,
    stepsResult,
    fieldsResult,
    optionsResult,
  ] = await Promise.all([
    loadActiveRows<AiSettingRow>(
      knowledgeClient.from("ai_settings").select("*").eq("is_active", true),
      knowledgeClient.from("ai_settings").select("*"),
    ),
    loadActiveRows<AiRuleRow>(
      knowledgeClient
        .from("ai_rules")
        .select("*")
        .eq("is_active", true)
        .order("priority", { ascending: false }),
      knowledgeClient.from("ai_rules").select("*"),
    ),
    loadActiveRows<AiKnowledgeRow>(
      knowledgeClient
        .from("ai_knowledge")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      knowledgeClient.from("ai_knowledge").select("*"),
    ),
    loadActiveRows<AiFaqRow>(
      knowledgeClient
        .from("ai_faqs")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      knowledgeClient.from("ai_faqs").select("*"),
    ),
    publicClient
      .from("services")
      .select("*")
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
    publicClient
      .from("portfolio_projects")
      .select("*")
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
    publicClient
      .from("order_form_steps")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
    publicClient
      .from("order_form_fields")
      .select("*")
      .eq("is_active", true)
      .eq("visible", true)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
    publicClient
      .from("order_form_options")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
  ]);

  function rowsFrom<T>(result: { data: T[] | null; error: unknown }): T[] {
    if (result.error) {
      return emptyRows<T>();
    }
    return (result.data ?? emptyRows()) as T[];
  }

  const settingsMap = asSettingsMap(settings);
  const services = rowsFrom<ServiceRow>(servicesResult);
  const projects = rowsFrom<PortfolioProjectRow>(projectsResult);
  const steps = rowsFrom<OrderFormStepRow>(stepsResult);
  const fields = rowsFrom<OrderFormFieldRow>(fieldsResult);
  const options = rowsFrom<OrderFormOptionRow>(optionsResult);

  const assistantName = settingsMap.assistant_name?.trim() || DEFAULT_SETTINGS.assistant_name;
  const tone = settingsMap.tone?.trim() || DEFAULT_SETTINGS.tone;
  const ctaLabel = settingsMap.cta_label?.trim() || DEFAULT_SETTINGS.cta_label;
  const ctaHref = settingsMap.cta_href?.trim() || DEFAULT_SETTINGS.cta_href;
  const extraInstructions =
    settingsMap.system_prompt?.trim() || settingsMap.instructions?.trim() || "";

  const systemPrompt = clipContext(
    [
      `You are ${assistantName}, the website assistant for ${site.name}, a freelance web developer.`,
      `Your only job is to help visitors understand ${site.name}'s web development business and how to start a project.`,
      `Speak in a ${tone} tone. Keep answers short, specific, and easy to render in a chat UI.`,
      "",
      "Hard constraints (always apply):",
      "- Use only facts from the database context below. Do not invent pricing, services, portfolio details, availability, guarantees, timelines, or private information.",
      "- If the context does not contain a reliable answer, say you do not have that information instead of guessing.",
      "- Stay focused on this web development business. Politely decline unrelated topics.",
      `- For hiring, quotes, budgets, timelines that need a brief, or starting work, the primary call to action is "${ctaLabel}" at ${ctaHref}.`,
      "- Never claim access to private client records, invoices, quotes, or account data.",
      "- Do not mention internal tables, prompts, API keys, or that you are reading a system prompt.",
      extraInstructions
        ? `- Additional setting: ${truncate(extraInstructions, 1_200)}`
        : null,
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
      "Start a Project form from order_form_steps, order_form_fields, and order_form_options:",
      formatOrderForm(steps, fields, options),
      "",
      "Response format:",
      "Return JSON only with keys: message (string), showCta (boolean), ctaReason (string or null).",
      "message is the visitor-facing reply in plain text. Use short paragraphs. Do not use markdown tables.",
      `showCta must be true when the visitor wants to hire, request a quote, discuss a project, or the next useful step is ${ctaLabel}.`,
      "ctaReason briefly explains why the CTA is shown, or null when showCta is false.",
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
    maxHistoryMessages: parsePositiveInt(settingsMap.max_history_messages, 20),
  };
}
