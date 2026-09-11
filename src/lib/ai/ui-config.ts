import { unstable_cache } from "next/cache";
import { DifyRequestError, fetchDifyJson, isDifyConfigured } from "@/lib/ai/dify";
import { errorMessage, logAiEvent } from "@/lib/ai/errors";
import { DEFAULT_AI_UI_CONFIG } from "@/lib/ai/ui-defaults";
import type { AiUiAvatarType, AiUiConfig } from "@/types/ai";

export { DEFAULT_AI_UI_CONFIG };
export const AI_UI_CONFIG_REVALIDATE_SECONDS = 300;

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

function asHttpUrl(value: unknown): string | null {
  const raw = asTrimmedString(value, 2_000);
  if (!raw || !/^https?:\/\//i.test(raw)) {
    return null;
  }
  try {
    const url = new URL(raw);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {
    return null;
  }
  return null;
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
    const question = asTrimmedString(item, QUESTION_MAX);
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
  const avatarType = asAvatarType(site?.icon_type);
  const iconUrl = asHttpUrl(site?.icon_url);
  const icon = asTrimmedString(site?.icon, 64);
  const avatar =
    avatarType === "image" ? iconUrl ?? fallback.avatar : iconUrl ?? icon ?? fallback.avatar;
  const questions = asQuestions(parameters?.suggested_questions);

  return {
    name: asTrimmedString(site?.title, NAME_MAX) ?? fallback.name,
    avatar: avatar ?? fallback.avatar,
    avatarType: avatarType ?? (iconUrl ? "image" : icon ? "emoji" : fallback.avatarType),
    welcomeMessage:
      asTrimmedString(parameters?.opening_statement, TEXT_MAX) ?? fallback.welcomeMessage,
    suggestedQuestions: questions.length > 0 ? questions : fallback.suggestedQuestions,
    inputPlaceholder:
      asTrimmedString(site?.input_placeholder, PLACEHOLDER_MAX) ?? fallback.inputPlaceholder,
    themeColor: asHexColor(site?.chat_color_theme) ?? fallback.themeColor,
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
      hasAvatar: Boolean(config.avatar),
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
