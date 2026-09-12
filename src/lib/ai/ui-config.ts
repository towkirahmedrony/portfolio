import { unstable_cache } from "next/cache";
import {
  DifyRequestError,
  fetchDifyJson,
  getDifyAssetOrigin,
  isDifyConfigured,
} from "@/lib/ai/dify";
import { errorMessage, logAiEvent } from "@/lib/ai/errors";
import { DEFAULT_AI_UI_CONFIG } from "@/lib/ai/ui-defaults";
import type { AiUiAvatarType, AiUiConfig } from "@/types/ai";

export { DEFAULT_AI_UI_CONFIG };
export const AI_UI_CONFIG_REVALIDATE_SECONDS = 300;

/** Same-origin passthrough the UI uses when Dify's own icon URL is unusable. */
export const DIFY_AVATAR_PROXY_PATH = "/api/ai/avatar";

const NAME_MAX = 80;
const TEXT_MAX = 800;
const PLACEHOLDER_MAX = 120;
const QUESTION_MAX = 160;
const QUESTIONS_MAX = 8;
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function asTrimmedString(value: unknown, max: number): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

/**
 * Resolves an asset Dify returned into the URL the browser should use.
 *
 * - absolute `http(s)://…` (Dify-hosted or otherwise) is returned verbatim;
 * - protocol-relative `//host/…` becomes `https://host/…`;
 * - a root-relative `/path` is resolved against the **Dify** origin, because
 *   that is where the asset lives — never against the website's own origin;
 * - anything else (data:, javascript:, …) is rejected.
 */
function resolveDifyAssetUrl(value: unknown): string | null {
  const raw = asTrimmedString(value, 2_000);
  if (!raw) {
    return null;
  }

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
    } catch {
      return null;
    }
  }

  if (raw.startsWith("//")) {
    try {
      return new URL(`https:${raw}`).toString();
    } catch {
      return null;
    }
  }

  if (raw.startsWith("/")) {
    const origin = getDifyAssetOrigin();
    if (!origin) {
      return null;
    }
    try {
      return new URL(raw, origin).toString();
    } catch {
      return null;
    }
  }

  return null;
}

/** Dify returns icon file ids as bare uuids; emoji icons are not file ids. */
function asFileId(value: unknown): string | null {
  const raw = asTrimmedString(value, 64);
  if (!raw || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
    return null;
  }
  return raw;
}

function asHexColor(value: unknown): string | null {
  const raw = asTrimmedString(value, 16);
  if (!raw || !HEX_COLOR.test(raw)) {
    return null;
  }
  return raw;
}

function asAvatarType(value: unknown): AiUiAvatarType | null {
  if (value === "emoji" || value === "image") {
    return value;
  }
  return null;
}

function asQuestions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const questions: string[] = [];
  for (const item of value) {
    // Dify normally returns plain strings; tolerate `{ question: "…" }` too.
    const raw =
      item && typeof item === "object" && !Array.isArray(item)
        ? (item as { question?: unknown }).question
        : item;
    const question = asTrimmedString(raw, QUESTION_MAX);
    if (!question || seen.has(question)) {
      continue;
    }
    seen.add(question);
    questions.push(question);
    if (questions.length >= QUESTIONS_MAX) {
      break;
    }
  }
  return questions;
}

type DifySite = {
  title?: unknown;
  icon?: unknown;
  icon_url?: unknown;
  icon_type?: unknown;
  input_placeholder?: unknown;
  chat_color_theme?: unknown;
};

type DifyParameters = {
  opening_statement?: unknown;
  suggested_questions?: unknown;
};

function mergeWithFallback(
  site: DifySite | null,
  parameters: DifyParameters | null,
): AiUiConfig {
  const fallback = DEFAULT_AI_UI_CONFIG;
  const iconUrl = resolveDifyAssetUrl(site?.icon_url);
  const icon = asTrimmedString(site?.icon, 64);
  const declaredType = asAvatarType(site?.icon_type);
  // Dify's icon is either an image (icon_url + a file id in `icon`) or an emoji.
  const isImage = declaredType === "image" ? true : declaredType === "emoji" ? false : Boolean(iconUrl);
  const fileId = isImage ? asFileId(icon) : null;
  const emoji = isImage ? null : icon;
  const questions = asQuestions(parameters?.suggested_questions);

  return {
    name: asTrimmedString(site?.title, NAME_MAX) ?? fallback.name,
    // Dify's exact URL is the primary source; the same-origin passthrough is
    // only used when a browser cannot load that URL directly (Dify's signed
    // cloud file URLs are rejected with 404 "signature is invalid").
    avatarUrl: isImage ? iconUrl : null,
    avatarProxyUrl: isImage && fileId ? DIFY_AVATAR_PROXY_PATH : null,
    avatarEmoji: emoji,
    avatarType: isImage ? "image" : emoji ? "emoji" : fallback.avatarType,
    avatarFileId: fileId,
    openingMessage:
      asTrimmedString(parameters?.opening_statement, TEXT_MAX) ?? fallback.openingMessage,
    // Dify is the only source of suggested questions: an empty list hides the
    // section rather than inventing questions Dify did not return.
    suggestedQuestions: questions,
    inputPlaceholder:
      asTrimmedString(site?.input_placeholder, PLACEHOLDER_MAX) ?? fallback.inputPlaceholder,
    themeColor: asHexColor(site?.chat_color_theme) ?? fallback.themeColor,
    configSource: "dify",
  };
}

async function loadDifyUiConfig(): Promise<AiUiConfig> {
  if (!isDifyConfigured()) {
    logAiEvent("log", "dify.ui-config.fallback", { reason: "not-configured" });
    return DEFAULT_AI_UI_CONFIG;
  }

  const startedAt = Date.now();
  try {
    const [site, parameters] = await Promise.all([
      fetchDifyJson("/site") as Promise<DifySite>,
      fetchDifyJson("/parameters") as Promise<DifyParameters>,
    ]);
    const config = mergeWithFallback(site, parameters);
    logAiEvent("log", "dify.ui-config", {
      success: true,
      durationMs: Date.now() - startedAt,
      hasAvatar: Boolean(config.avatarUrl ?? config.avatarEmoji),
      suggestedCount: config.suggestedQuestions.length,
    });
    return config;
  } catch (error) {
    logAiEvent("error", "dify.ui-config.fallback", {
      durationMs: Date.now() - startedAt,
      code: error instanceof DifyRequestError ? error.code : "unknown",
      error: errorMessage(error),
    });
    return DEFAULT_AI_UI_CONFIG;
  }
}

const loadCachedAiUiConfig = unstable_cache(
  async () => loadDifyUiConfig(),
  ["ai-assistant-ui-config"],
  { revalidate: AI_UI_CONFIG_REVALIDATE_SECONDS },
);

export async function getAiUiConfig(): Promise<AiUiConfig> {
  try {
    return await loadCachedAiUiConfig();
  } catch (error) {
    logAiEvent("error", "dify.ui-config.fallback", {
      reason: "cache",
      error: errorMessage(error),
    });
    return DEFAULT_AI_UI_CONFIG;
  }
}
