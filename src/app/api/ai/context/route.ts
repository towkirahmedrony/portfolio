import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { errorMessage } from "@/lib/ai/errors";
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

/**
 * Server-to-server read-only context endpoint for Dify.
 *
 *   Visitor -> Dify User Input -> POST /api/ai/context -> Supabase -> JSON -> Dify LLM -> Answer
 *
 * This route only READS the live Supabase database and returns plain data. It never
 * generates an answer, never calls an AI provider (no Gemini, no external API), and
 * never writes/creates/updates/deletes rows. No migration or schema change is needed.
 *
 * Column names mirror the LIVE schema, which is the source of truth:
 *   services            -> published (boolean), starting_price (public starting price,
 *                          never a guaranteed final quote), sort_order
 *   portfolio_projects  -> published (boolean), sort_order
 *   ai_knowledge        -> priority, is_active
 *   ai_rules            -> name (NOT title), priority, is_active
 *   ai_faqs             -> keywords, priority, is_active
 *   ai_settings         -> setting_key / setting_value (NOT key / value), is_active
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const GENERIC_ERROR = "Unable to load assistant context.";
const SECRET_HEADER = "x-dify-context-secret";
const QUERY_MAX_CHARS = 500;

/** Bounded reads: never pull a whole table for one visitor question. */
const LIMITS = {
  fetch: 24,
  settingsFetch: 60,
  rules: 10,
  knowledge: { focused: 6, general: 3 },
  faqs: { focused: 6, general: 3 },
  services: { focused: 6, general: 4 },
  projects: { focused: 6, general: 2 },
} as const;

/** Field clipping keeps the payload compact without dropping whole records. */
const TEXT_LIMITS = {
  shortDescription: 280,
  description: 700,
  knowledgeContent: 900,
  ruleInstruction: 600,
  faqAnswer: 700,
  settingValue: 500,
} as const;

/** Settings whose key looks secret-bearing are never returned. */
const SENSITIVE_SETTING_KEY =
  /(secret|token|api[_-]?key|apikey|password|passwd|credential|private[_-]?key|access[_-]?key|service[_-]?role|bearer|webhook|dsn|connection[_-]?string|gemini|openai|anthropic|supabase)/i;

/* -------------------------------------------------------------------------- */
/* Column projections (only the columns the visitor-facing context needs)      */
/* -------------------------------------------------------------------------- */

type ServicePicker = Pick<
  ServiceRow,
  | "name"
  | "slug"
  | "short_description"
  | "description"
  | "starting_price"
  | "currency"
  | "estimated_days_min"
  | "estimated_days_max"
  | "featured"
  | "sort_order"
>;

type ProjectPicker = Pick<
  PortfolioProjectRow,
  | "title"
  | "slug"
  | "short_description"
  | "description"
  | "category"
  | "technologies"
  | "live_url"
  | "github_url"
  | "featured"
  | "sort_order"
>;

type KnowledgePicker = Pick<AiKnowledgeRow, "category" | "title" | "content" | "priority">;
type RulePicker = Pick<AiRuleRow, "rule_type" | "name" | "instruction" | "priority">;
type FaqPicker = Pick<AiFaqRow, "category" | "question" | "answer" | "keywords" | "priority">;
type SettingPicker = Pick<AiSettingRow, "setting_key" | "setting_value">;

type ServiceContext = {
  name: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  starting_price: number | null;
  currency: string | null;
  estimated_days_min: number | null;
  estimated_days_max: number | null;
  featured: boolean;
  sort_order: number;
};

type ProjectContext = {
  title: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  category: string | null;
  technologies: string[];
  live_url: string | null;
  github_url: string | null;
  featured: boolean;
  sort_order: number;
};

type KnowledgeContext = {
  category: string | null;
  title: string;
  content: string;
  priority: number;
};

type RuleContext = {
  rule_type: string;
  name: string;
  instruction: string;
  priority: number;
};

type FaqContext = {
  category: string | null;
  question: string;
  answer: string;
  keywords: string[];
  priority: number;
};

type DifyContext = {
  rules: RuleContext[];
  knowledge: KnowledgeContext[];
  faqs: FaqContext[];
  settings: Record<string, string>;
  services: ServiceContext[];
  projects: ProjectContext[];
};

/* -------------------------------------------------------------------------- */
/* Small utilities                                                            */
/* -------------------------------------------------------------------------- */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function clip(value: unknown, max: number): string | null {
  const trimmed = text(value);
  if (!trimmed) {
    return null;
  }
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max - 3).trimEnd()}...`;
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toIntOrNull(value: unknown): number | null {
  const parsed = toNumberOrNull(value);
  if (parsed === null) {
    return null;
  }
  return Number.isInteger(parsed) ? parsed : Math.round(parsed);
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  const single = text(value);
  return single ? [single] : [];
}

/**
 * Constant-time secret comparison. Both sides are hashed first so inputs of
 * different lengths cannot leak the expected secret's length.
 */
function secretsMatch(presented: string, expected: string): boolean {
  const presentedHash = createHash("sha256").update(presented, "utf8").digest();
  const expectedHash = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(presentedHash, expectedHash);
}

/**
 * Dify authenticates with a dedicated header. `Authorization: Bearer <secret>`
 * is accepted as a fallback for setups already using that convention.
 * The secret is read from the environment on every request and is never
 * hardcoded, logged, or returned.
 */
function isAuthorized(request: Request): boolean {
  const expected = process.env.DIFY_CONTEXT_SECRET?.trim();
  if (!expected) {
    // Fail closed: an unconfigured secret must never authenticate a caller.
    return false;
  }

  const headerSecret = request.headers.get(SECRET_HEADER)?.trim() ?? "";
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const bearerSecret = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";

  const presented = headerSecret || bearerSecret;
  if (!presented) {
    return false;
  }

  return secretsMatch(presented, expected);
}

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/* -------------------------------------------------------------------------- */
/* Lightweight keyword / relevance matching (no embeddings, no external APIs)  */
/* -------------------------------------------------------------------------- */

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "than", "so", "to", "of",
  "in", "on", "at", "for", "with", "about", "as", "by", "from", "into", "over",
  "after", "is", "are", "was", "were", "be", "been", "being", "am", "do", "does",
  "did", "doing", "have", "has", "had", "having", "i", "me", "my", "we", "our",
  "you", "your", "he", "she", "it", "its", "they", "them", "their", "this",
  "that", "these", "those", "what", "which", "who", "whom", "how", "when",
  "where", "why", "can", "could", "should", "would", "will", "shall", "may",
  "might", "must", "not", "no", "yes", "please", "hi", "hello", "hey", "there",
  "here", "also", "just", "any", "some", "more", "most", "very", "much", "many",
  "get", "got", "give", "make", "made", "use", "using", "like", "well", "good",
  "best", "help", "thanks", "thank", "okay", "ok", "let", "lets", "im", "ive",
]);

/** Terms that mean "the visitor is asking about what we offer". */
const SERVICE_TERMS = new Set([
  "service", "services", "offering", "offerings", "offer", "offers", "website",
  "websites", "web", "webdev", "site", "sites", "webpage", "webpages", "page",
  "pages", "landing", "shop", "shopping", "store", "stores", "ecommerce",
  "commerce", "shopify", "woocommerce", "wordpress", "cms", "development",
  "develop", "developer", "developers", "build", "rebuild", "redesign",
  "revamp", "maintenance", "support", "hosting", "domain", "seo", "api",
  "integration", "integrations", "dashboard", "booking", "payment", "payments",
  "saas", "app", "apps", "application", "applications", "platform", "mvp",
  "frontend", "backend", "fullstack", "responsive", "mobile", "nextjs", "react",
  "typescript", "tailwind", "javascript", "node", "stack", "capability",
  "capabilities", "technology", "technologies", "skill", "skills", "price",
  "pricing", "cost", "costs", "budget", "budgets", "quote", "quotation",
  "estimate", "timeline", "deadline", "duration", "deliverable", "deliverables",
  "package", "packages", "rate", "rates", "fee", "fees",
]);

/** Terms that mean "the visitor is asking about previous work". */
const PROJECT_TERMS = new Set([
  "project", "projects", "portfolio", "work", "works", "worked", "example",
  "examples", "sample", "samples", "case", "study", "studies", "showcase",
  "demo", "demos", "previous", "past", "recent", "built", "completed", "client",
  "clients", "github", "repo", "repository", "screenshot", "screenshots",
]);

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokensOf(value: string, max = 14): string[] {
  const tokens: string[] = [];
  const seen = new Set<string>();
  for (const token of normalizeText(value).split(" ")) {
    if (token.length < 2 || STOPWORDS.has(token) || seen.has(token)) {
      continue;
    }
    seen.add(token);
    tokens.push(token);
    if (tokens.length >= max) {
      break;
    }
  }
  return tokens;
}

function wordsOf(value: string): Set<string> {
  const words = new Set<string>();
  for (const word of normalizeText(value).split(" ")) {
    if (word.length >= 2) {
      words.add(word);
    }
  }
  return words;
}

/** Cheap token overlap with a prefix fallback for simple word variants. */
function overlapScore(tokens: readonly string[], haystack: Set<string>): number {
  if (tokens.length === 0 || haystack.size === 0) {
    return 0;
  }

  let score = 0;
  for (const token of tokens) {
    if (haystack.has(token)) {
      score += 3;
      continue;
    }
    if (token.length < 4) {
      continue;
    }
    for (const word of haystack) {
      if (word.length >= 4 && (word.startsWith(token) || token.startsWith(word))) {
        score += 1;
        break;
      }
    }
  }
  return score;
}

function hasIntent(tokens: readonly string[], terms: Set<string>): boolean {
  return tokens.some((token) => terms.has(token));
}

/* -------------------------------------------------------------------------- */
/* Section projection + ranking                                               */
/* -------------------------------------------------------------------------- */

function toServiceContext(row: ServicePicker): ServiceContext {
  return {
    name: text(row.name),
    slug: text(row.slug),
    short_description: clip(row.short_description, TEXT_LIMITS.shortDescription),
    description: clip(row.description, TEXT_LIMITS.description),
    // Public STARTING price only - never a guaranteed final quote.
    starting_price: toNumberOrNull(row.starting_price),
    currency: text(row.currency) || null,
    estimated_days_min: toIntOrNull(row.estimated_days_min),
    estimated_days_max: toIntOrNull(row.estimated_days_max),
    featured: row.featured === true,
    sort_order: toIntOrNull(row.sort_order) ?? 0,
  };
}

function toProjectContext(row: ProjectPicker): ProjectContext {
  return {
    title: text(row.title),
    slug: text(row.slug),
    short_description: clip(row.short_description, TEXT_LIMITS.shortDescription),
    description: clip(row.description, TEXT_LIMITS.description),
    category: text(row.category) || null,
    technologies: toStringArray(row.technologies),
    live_url: text(row.live_url) || null,
    github_url: text(row.github_url) || null,
    featured: row.featured === true,
    sort_order: toIntOrNull(row.sort_order) ?? 0,
  };
}

function toKnowledgeContext(row: KnowledgePicker): KnowledgeContext {
  return {
    category: text(row.category) || null,
    title: text(row.title),
    content: clip(row.content, TEXT_LIMITS.knowledgeContent) ?? "",
    priority: toIntOrNull(row.priority) ?? 0,
  };
}

function toRuleContext(row: RulePicker): RuleContext {
  return {
    rule_type: text(row.rule_type),
    name: text(row.name),
    instruction: clip(row.instruction, TEXT_LIMITS.ruleInstruction) ?? "",
    priority: toIntOrNull(row.priority) ?? 0,
  };
}

function toFaqContext(row: FaqPicker): FaqContext {
  return {
    category: text(row.category) || null,
    question: text(row.question),
    answer: clip(row.answer, TEXT_LIMITS.faqAnswer) ?? "",
    keywords: toStringArray(row.keywords),
    priority: toIntOrNull(row.priority) ?? 0,
  };
}

/** Only active settings are returned, as a flat `{ setting_key: setting_value }` map. */
function toSettingsMap(rows: readonly SettingPicker[]): Record<string, string> {
  const settings: Record<string, string> = {};

  for (const row of rows) {
    const key = text(row.setting_key);
    if (!key || SENSITIVE_SETTING_KEY.test(key) || key in settings) {
      continue;
    }
    settings[key] = clip(row.setting_value, TEXT_LIMITS.settingValue) ?? "";
    if (Object.keys(settings).length >= LIMITS.settingsFetch) {
      break;
    }
  }

  return settings;
}

/**
 * `match` is pure keyword relevance (used only to decide whether the visitor is
 * actually asking about this section); `score` is the ranking value and may
 * include the `featured` bonus.
 */
type Scored<T> = { row: T; score: number; match: number };

/**
 * A section is "focused" when the query names that section's topic, or when a
 * row genuinely matched a keyword. Focused sections get a larger slice; general
 * questions only get a small high-priority sample.
 */
function isFocused(scored: readonly Scored<unknown>[], intent: boolean): boolean {
  return intent || (scored[0]?.match ?? 0) > 0;
}

function takeScored<T, R>(
  scored: readonly Scored<T>[],
  focused: boolean,
  limits: { focused: number; general: number },
  map: (row: T) => R,
): R[] {
  const limit = focused ? limits.focused : limits.general;
  return scored.slice(0, limit).map((entry) => map(entry.row));
}

function rankServices(
  rows: readonly ServicePicker[],
  tokens: readonly string[],
): Scored<ServicePicker>[] {
  const scored = rows.map((row) => {
    const match = overlapScore(
      tokens,
      wordsOf(`${row.name} ${row.slug} ${row.short_description ?? ""} ${row.description ?? ""}`),
    );
    return { row, match, score: match + (row.featured === true ? 1 : 0) };
  });

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      Number(b.row.featured === true) - Number(a.row.featured === true) ||
      (toIntOrNull(a.row.sort_order) ?? 0) - (toIntOrNull(b.row.sort_order) ?? 0),
  );

  return scored;
}

function rankProjects(
  rows: readonly ProjectPicker[],
  tokens: readonly string[],
): Scored<ProjectPicker>[] {
  const scored = rows.map((row) => {
    const match = overlapScore(
      tokens,
      wordsOf(
        [
          row.title,
          row.slug,
          row.category ?? "",
          row.short_description ?? "",
          row.description ?? "",
          toStringArray(row.technologies).join(" "),
        ].join(" "),
      ),
    );
    return { row, match, score: match + (row.featured === true ? 1 : 0) };
  });

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      Number(b.row.featured === true) - Number(a.row.featured === true) ||
      (toIntOrNull(a.row.sort_order) ?? 0) - (toIntOrNull(b.row.sort_order) ?? 0),
  );

  return scored;
}

function rankKnowledge(
  rows: readonly KnowledgePicker[],
  tokens: readonly string[],
): Scored<KnowledgePicker>[] {
  const scored = rows.map((row) => {
    const match = overlapScore(
      tokens,
      wordsOf(`${row.title} ${row.category ?? ""} ${row.content ?? ""}`),
    );
    return { row, match, score: match };
  });

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      (toIntOrNull(b.row.priority) ?? 0) - (toIntOrNull(a.row.priority) ?? 0),
  );

  return scored;
}

function rankFaqs(
  rows: readonly FaqPicker[],
  tokens: readonly string[],
  normalizedQuery: string,
): Scored<FaqPicker>[] {
  const scored = rows.map((row) => {
    const keywords = toStringArray(row.keywords);
    let score = overlapScore(
      tokens,
      wordsOf(`${row.question} ${row.answer ?? ""} ${keywords.join(" ")}`),
    );

    // A keyword that literally appears in the question is a strong signal.
    for (const keyword of keywords) {
      const normalized = normalizeText(keyword);
      if (normalized.length >= 3 && normalizedQuery.includes(normalized)) {
        score += 3;
      }
    }

    // For FAQs the whole score is relevance - there is no featured bonus.
    return { row, match: score, score };
  });

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      (toIntOrNull(b.row.priority) ?? 0) - (toIntOrNull(a.row.priority) ?? 0),
  );

  return scored;
}

/** Rules are behavioural and always relevant; highest priority first. */
function selectRules(rows: readonly RulePicker[]): RuleContext[] {
  return rows.slice(0, LIMITS.rules).map((row) => toRuleContext(row));
}

/* -------------------------------------------------------------------------- */
/* Data access                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Unwraps a PostgREST response. Raw Supabase/SQL errors stay on the server:
 * the caller only ever sees the generic 500 payload.
 */
async function runQuery<T>(
  source: string,
  run: () => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  try {
    const { data, error } = await run();
    if (error) {
      throw new Error(`query failed: ${source} (${errorMessage(error)})`);
    }
    return Array.isArray(data) ? (data as T[]) : [];
  } catch (error) {
    // Diagnostics stay server-side; the caller only ever sees a generic 500.
    console.error("[ai-context]", {
      stage: "query.failed",
      source,
      error: errorMessage(error),
    });
    throw error instanceof Error ? error : new Error(`query failed: ${source}`);
  }
}

type Timings = {
  servicesMs: number;
  projectsMs: number;
  knowledgeMs: number;
  rulesMs: number;
  faqsMs: number;
  settingsMs: number;
};

type ResultCounts = {
  rules: number;
  knowledge: number;
  faqs: number;
  settings: number;
  services: number;
  projects: number;
};

/**
 * Loads the compact AI-safe context for one visitor question.
 *
 * Every section is an independent Supabase query and they all run in a single
 * `Promise.all` - no sequential waterfalls - because latency is the reason this
 * endpoint exists. Only the required columns, only public/active rows, bounded
 * limits, no external APIs, no AI calls, read-only.
 */
async function buildDifyContext(query: string): Promise<DifyContext> {
  const startedAt = Date.now();
  const timings: Timings = {
    servicesMs: 0,
    projectsMs: 0,
    knowledgeMs: 0,
    rulesMs: 0,
    faqsMs: 0,
    settingsMs: 0,
  };
  const counts: ResultCounts = {
    rules: 0,
    knowledge: 0,
    faqs: 0,
    settings: 0,
    services: 0,
    projects: 0,
  };

  try {
    const client = createServiceRoleSupabaseClient();

    const measured = async <T>(key: keyof Timings, task: () => Promise<T>): Promise<T> => {
      const from = Date.now();
      try {
        return await task();
      } finally {
        timings[key] = Date.now() - from;
      }
    };

    const [services, projects, knowledge, rules, faqs, settings] = await Promise.all([
      measured("servicesMs", () =>
        runQuery<ServicePicker>("services", () =>
          client
            .from("services")
            .select(
              "name,slug,short_description,description,starting_price,currency,estimated_days_min,estimated_days_max,featured,sort_order",
            )
            // Public read only: never expose unpublished services.
            .eq("published", true)
            .order("sort_order", { ascending: true })
            .limit(LIMITS.fetch),
        ),
      ),
      measured("projectsMs", () =>
        runQuery<ProjectPicker>("portfolio_projects", () =>
          client
            .from("portfolio_projects")
            .select(
              "title,slug,short_description,description,category,technologies,live_url,github_url,featured,sort_order",
            )
            // Public read only: never expose unpublished projects.
            .eq("published", true)
            .order("sort_order", { ascending: true })
            .limit(LIMITS.fetch),
        ),
      ),
      measured("knowledgeMs", () =>
        runQuery<KnowledgePicker>("ai_knowledge", () =>
          client
            .from("ai_knowledge")
            .select("category,title,content,priority")
            .eq("is_active", true)
            // ai_knowledge orders by priority - it has no sort_order column.
            .order("priority", { ascending: false })
            .limit(LIMITS.fetch),
        ),
      ),
      measured("rulesMs", () =>
        runQuery<RulePicker>("ai_rules", () =>
          client
            .from("ai_rules")
            .select("rule_type,name,instruction,priority")
            .eq("is_active", true)
            // ai_rules has `name`, not `title`.
            .order("priority", { ascending: false })
            .limit(LIMITS.fetch),
        ),
      ),
      measured("faqsMs", () =>
        runQuery<FaqPicker>("ai_faqs", () =>
          client
            .from("ai_faqs")
            .select("category,question,answer,keywords,priority")
            .eq("is_active", true)
            .order("priority", { ascending: false })
            .limit(LIMITS.fetch),
        ),
      ),
      measured("settingsMs", () =>
        runQuery<SettingPicker>("ai_settings", () =>
          client
            .from("ai_settings")
            // ai_settings uses setting_key / setting_value, not key / value.
            .select("setting_key,setting_value")
            .eq("is_active", true)
            .limit(LIMITS.settingsFetch),
        ),
      ),
    ]);

    const normalizedQuery = normalizeText(query);
    const tokens = tokensOf(query);

    const rankedServices = rankServices(services, tokens);
    const rankedProjects = rankProjects(projects, tokens);
    const rankedKnowledge = rankKnowledge(knowledge, tokens);
    const rankedFaqs = rankFaqs(faqs, tokens, normalizedQuery);

    const rankedServicesOut = takeScored(
      rankedServices,
      isFocused(rankedServices, hasIntent(tokens, SERVICE_TERMS)),
      LIMITS.services,
      toServiceContext,
    );
    const rankedProjectsOut = takeScored(
      rankedProjects,
      isFocused(rankedProjects, hasIntent(tokens, PROJECT_TERMS)),
      LIMITS.projects,
      toProjectContext,
    );
    const rankedKnowledgeOut = takeScored(
      rankedKnowledge,
      isFocused(rankedKnowledge, false),
      LIMITS.knowledge,
      toKnowledgeContext,
    );
    const rankedFaqsOut = takeScored(
      rankedFaqs,
      isFocused(rankedFaqs, false),
      LIMITS.faqs,
      toFaqContext,
    );
    const selectedRules = selectRules(rules);
    const settingsMap = toSettingsMap(settings);

    counts.services = rankedServicesOut.length;
    counts.projects = rankedProjectsOut.length;
    counts.knowledge = rankedKnowledgeOut.length;
    counts.faqs = rankedFaqsOut.length;
    counts.rules = selectedRules.length;
    counts.settings = Object.keys(settingsMap).length;

    return {
      rules: selectedRules,
      knowledge: rankedKnowledgeOut,
      faqs: rankedFaqsOut,
      settings: settingsMap,
      services: rankedServicesOut,
      projects: rankedProjectsOut,
    };
  } finally {
    // Timing/result metadata only: never the visitor query, secrets, or records.
    console.log("[ai-context]", {
      totalMs: Date.now() - startedAt,
      servicesMs: timings.servicesMs,
      projectsMs: timings.projectsMs,
      knowledgeMs: timings.knowledgeMs,
      rulesMs: timings.rulesMs,
      faqsMs: timings.faqsMs,
      settingsMs: timings.settingsMs,
      resultCounts: counts,
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Route handler                                                              */
/* -------------------------------------------------------------------------- */

export async function POST(request: Request) {
  const startedAt = Date.now();

  if (!isAuthorized(request)) {
    // Same generic answer for missing, malformed, and wrong secrets.
    console.log("[ai-context]", {
      stage: "unauthorized",
      totalMs: Date.now() - startedAt,
    });
    return jsonResponse(401, { success: false, error: "Unauthorized." });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(400, { success: false, error: "Invalid JSON body." });
  }

  if (!isRecord(payload) || typeof payload.query !== "string") {
    return jsonResponse(400, { success: false, error: "Invalid request body." });
  }

  const query = payload.query.trim().slice(0, QUERY_MAX_CHARS);

  if (!isServiceRoleConfigured()) {
    console.error("[ai-context]", { stage: "config", totalMs: Date.now() - startedAt });
    return jsonResponse(500, { success: false, error: GENERIC_ERROR });
  }

  try {
    const context = await buildDifyContext(query);
    return jsonResponse(200, { success: true, context });
  } catch (error) {
    console.error("[ai-context]", {
      stage: "failure",
      totalMs: Date.now() - startedAt,
      error: errorMessage(error),
    });
    return jsonResponse(500, { success: false, error: GENERIC_ERROR });
  }
}
