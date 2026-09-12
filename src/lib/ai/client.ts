import { DEFAULT_AI_UI_CONFIG } from "@/lib/ai/ui-defaults";
import type {
  AiChatErrorResponse,
  AiChatHistoryResponse,
  AiChatMessage,
  AiChatStreamEvent,
  AiChatSuccessResponse,
  AiUiConfig,
  AiUiConfigResponse,
} from "@/types/ai";

export const AI_CHAT_ENDPOINT = "/api/ai/chat";
export const AI_CONFIG_ENDPOINT = "/api/ai/config";
export const AI_SESSION_STORAGE_KEY = "ai-project-assistant-session";
export const AI_MESSAGE_MAX = 4_000;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isAiSessionId(value: string | null | undefined): value is string {
  return Boolean(value && UUID_PATTERN.test(value));
}

export function readStoredAiSessionId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const value = window.sessionStorage.getItem(AI_SESSION_STORAGE_KEY);
    return isAiSessionId(value) ? value : null;
  } catch {
    return null;
  }
}

export function storeAiSessionId(sessionId: string): void {
  if (typeof window === "undefined" || !isAiSessionId(sessionId)) {
    return;
  }

  try {
    window.sessionStorage.setItem(AI_SESSION_STORAGE_KEY, sessionId);
  } catch {
    // Private browsing or blocked storage should not break chat.
  }
}

export function clearStoredAiSessionId(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(AI_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

/* -------------------------------------------------------------------------- */
/* Client-side caching                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Two deliberately separate sessionStorage entries — no database, no new
 * backend storage, and no server change:
 *
 * - `history`: the current conversation, so returning to /ai-assistant renders
 *   it immediately instead of fetching it again. TTL 5 minutes.
 * - `config`: Dify's UI configuration (name, avatar, welcome message, suggested
 *   questions, input placeholder), so navigation does not re-ask Dify each
 *   time. TTL 5 minutes.
 *
 * sessionStorage survives client-side navigation and reloads within the tab and
 * is discarded when the tab closes, which is exactly the desired lifetime.
 * A cache miss or an expired/corrupt entry simply falls back to the network.
 */
export const AI_HISTORY_CACHE_KEY = "ai-project-assistant-history";
export const AI_CONFIG_CACHE_KEY = "ai-project-assistant-config";
export const AI_HISTORY_CACHE_TTL_MS = 5 * 60 * 1000;
export const AI_CONFIG_CACHE_TTL_MS = 5 * 60 * 1000;

const AI_CACHE_VERSION = 1;

type AiHistoryCache = {
  version: number;
  sessionId: string;
  messages: AiChatMessage[];
  cachedAt: number;
};

type AiUiConfigCache = {
  version: number;
  config: AiUiConfig;
  cachedAt: number;
};

function isCachedMessage(value: unknown): value is AiChatMessage {
  if (!value || typeof value !== "object") {
    return false;
  }
  const message = value as Partial<AiChatMessage>;
  return (
    typeof message.id === "string" &&
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string"
  );
}

function isHistoryCache(value: unknown): value is AiHistoryCache {
  if (!value || typeof value !== "object") {
    return false;
  }
  const entry = value as Partial<AiHistoryCache>;
  return (
    entry.version === AI_CACHE_VERSION &&
    isAiSessionId(entry.sessionId) &&
    Array.isArray(entry.messages) &&
    entry.messages.every(isCachedMessage) &&
    typeof entry.cachedAt === "number"
  );
}

function isUiConfigCache(value: unknown): value is AiUiConfigCache {
  if (!value || typeof value !== "object") {
    return false;
  }
  const entry = value as Partial<AiUiConfigCache>;
  const config = entry.config as Partial<AiUiConfig> | undefined;
  return (
    entry.version === AI_CACHE_VERSION &&
    typeof entry.cachedAt === "number" &&
    Boolean(config) &&
    typeof config?.name === "string" &&
    typeof config?.openingMessage === "string" &&
    typeof config?.inputPlaceholder === "string" &&
    Array.isArray(config?.suggestedQuestions)
  );
}

/** An entry older than this is never used, stale or not. */
const AI_CACHE_HARD_MAX_MS = 24 * 60 * 60 * 1000;

function readCache<T>(
  key: string,
  guard: (value: unknown) => value is T,
  ttlMs: number,
  allowStale = false,
): T | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof (parsed as { cachedAt?: unknown }).cachedAt !== "number" ||
      !Number.isFinite((parsed as { cachedAt: number }).cachedAt)
    ) {
      window.sessionStorage.removeItem(key);
      return null;
    }

    const age = Date.now() - (parsed as { cachedAt: number }).cachedAt;
    const limit = allowStale ? AI_CACHE_HARD_MAX_MS : ttlMs;
    if (age < 0 || age > limit || !guard(parsed)) {
      // Past the TTL the caller simply re-fetches; past the hard limit, or
      // structurally broken, the entry is dropped for good.
      if (age > limit) {
        window.sessionStorage.removeItem(key);
      }
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: unknown): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: caching is an optimisation, never a requirement.
  }
}

function removeCache(key: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}

/**
 * The cached conversation, or null when absent/expired.
 *
 * `allowStale` returns an expired-but-still-valid entry, which is what makes
 * the conversation feel permanent: the UI renders it immediately and refreshes
 * it in the background instead of showing a spinner.
 */
export function readAiHistoryCache(
  options: { allowStale?: boolean } = {},
): {
  sessionId: string;
  messages: AiChatMessage[];
  cachedAt: number;
  stale: boolean;
} | null {
  const entry = readCache(
    AI_HISTORY_CACHE_KEY,
    isHistoryCache,
    AI_HISTORY_CACHE_TTL_MS,
    options.allowStale === true,
  );
  if (!entry) {
    return null;
  }
  return {
    sessionId: entry.sessionId,
    messages: entry.messages,
    cachedAt: entry.cachedAt,
    stale: Date.now() - entry.cachedAt > AI_HISTORY_CACHE_TTL_MS,
  };
}

/**
 * Caches the conversation after it is loaded or updated. Optimistic (`local-`)
 * messages are never persisted, so a cached list can always be merged with a
 * server list without producing duplicates.
 */
export function writeAiHistoryCache(sessionId: string, messages: AiChatMessage[]): void {
  if (!isAiSessionId(sessionId)) {
    return;
  }

  writeCache(AI_HISTORY_CACHE_KEY, {
    version: AI_CACHE_VERSION,
    sessionId,
    messages: messages.filter((message) => !message.id.startsWith("local-")),
    cachedAt: Date.now(),
  } satisfies AiHistoryCache);
}

export function clearAiHistoryCache(): void {
  removeCache(AI_HISTORY_CACHE_KEY);
}

/**
 * Dify's UI configuration, or null when absent/expired. `allowStale` returns an
 * expired-but-valid entry so the page can render instantly while it refreshes.
 */
export function readAiConfigCache(
  options: { allowStale?: boolean } = {},
): AiUiConfig | null {
  const entry = readCache(
    AI_CONFIG_CACHE_KEY,
    isUiConfigCache,
    AI_CONFIG_CACHE_TTL_MS,
    options.allowStale === true,
  );
  return entry ? entry.config : null;
}

/** Only real Dify configuration is cached, never the local fallback. */
export function writeAiConfigCache(config: AiUiConfig): void {
  writeCache(AI_CONFIG_CACHE_KEY, {
    version: AI_CACHE_VERSION,
    config,
    cachedAt: Date.now(),
  } satisfies AiUiConfigCache);
  notifyAiConfigCache();
}

export function clearAiConfigCache(): void {
  removeCache(AI_CONFIG_CACHE_KEY);
  notifyAiConfigCache();
}

/* -------------------------------------------------------------------------- */
/* Configuration store                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Tiny external store over the config cache, consumed with
 * `useSyncExternalStore` (the same pattern the theme toggle uses). It lets the
 * header, hero and composer render Dify's configuration immediately —
 * including a stale copy while a refresh is in flight — without reading
 * `sessionStorage` during render, which would desynchronise hydration.
 */
const aiConfigListeners = new Set<() => void>();
let aiConfigSnapshotRaw: string | null = null;
let aiConfigSnapshot: AiUiConfig | null = null;

function notifyAiConfigCache(): void {
  for (const listener of aiConfigListeners) {
    listener();
  }
}

export function subscribeAiConfigCache(listener: () => void): () => void {
  aiConfigListeners.add(listener);
  return () => {
    aiConfigListeners.delete(listener);
  };
}

/** Stable snapshot: the parsed value only changes when the stored string does. */
export function getAiConfigCacheSnapshot(): AiUiConfig | null {
  const raw =
    typeof window === "undefined" ? null : window.sessionStorage.getItem(AI_CONFIG_CACHE_KEY);

  if (raw !== aiConfigSnapshotRaw) {
    aiConfigSnapshotRaw = raw;
    // Stale entries are still valid configuration: render it, then refresh.
    aiConfigSnapshot = readAiConfigCache({ allowStale: true });
  }

  return aiConfigSnapshot;
}

/** Server/hydration snapshot — never storage, always deterministic. */
export function getServerAiConfigSnapshot(): AiUiConfig | null {
  return null;
}

export function createLocalAiMessage(
  role: AiChatMessage["role"],
  content: string,
): AiChatMessage {
  return {
    id: `local-${role}-${crypto.randomUUID()}`,
    role,
    content,
    createdAt: new Date().toISOString(),
    cta: null,
  };
}

function asError(payload: unknown, fallback: string): string {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof (payload as AiChatErrorResponse).error === "string" &&
    (payload as AiChatErrorResponse).error.trim().length > 0
  ) {
    return (payload as AiChatErrorResponse).error;
  }
  return fallback;
}

function fallbackForStatus(status: number, fallback: string): string {
  if (status === 429) {
    return "The assistant is busy right now. Please try again in a moment.";
  }
  if (status === 503) {
    return "The assistant is not available right now.";
  }
  if (status === 504) {
    return "The assistant took too long to reply. Please try again.";
  }
  if (status >= 500) {
    return fallback;
  }
  return fallback;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export class AiChatRequestError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = "AiChatRequestError";
    this.status = status;
    this.code = code;
  }
}

function asCode(payload: unknown): string | null {
  if (
    payload &&
    typeof payload === "object" &&
    "code" in payload &&
    typeof (payload as AiChatErrorResponse).code === "string"
  ) {
    return (payload as AiChatErrorResponse).code ?? null;
  }
  return null;
}

export type StreamAiChatHandlers = {
  onSession?: (sessionId: string) => void;
  onDelta?: (text: string) => void;
};

function parseStreamEvent(line: string): AiChatStreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed) as AiChatStreamEvent;
    if (!parsed || typeof parsed !== "object" || !("type" in parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function sendAiChatMessage(
  input: {
    message: string;
    sessionId: string | null;
  },
  handlers: StreamAiChatHandlers = {},
): Promise<AiChatSuccessResponse> {
  let response: Response;
  try {
    response = await fetch(AI_CHAT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/x-ndjson",
      },
      credentials: "same-origin",
      body: JSON.stringify({
        message: input.message,
        sessionId: input.sessionId ?? undefined,
      }),
    });
  } catch (error) {
    if (error instanceof AiChatRequestError) {
      throw error;
    }
    throw new AiChatRequestError(
      "Could not reach the assistant. Check your connection and try again.",
      0,
      "network",
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  const streaming = contentType.includes("application/x-ndjson") && Boolean(response.body);

  if (!streaming) {
    const payload = await readJson(response);
    if (
      response.ok &&
      payload &&
      typeof payload === "object" &&
      "ok" in payload &&
      (payload as AiChatSuccessResponse).ok === true &&
      "message" in payload
    ) {
      const success = payload as AiChatSuccessResponse;
      handlers.onSession?.(success.sessionId);
      if (success.message.content) {
        handlers.onDelta?.(success.message.content);
      }
      return success;
    }

    throw new AiChatRequestError(
      asError(
        payload,
        fallbackForStatus(response.status, "Could not send that message. Please try again."),
      ),
      response.status,
      asCode(payload),
    );
  }

  if (!response.ok) {
    const payload = await readJson(response);
    throw new AiChatRequestError(
      asError(
        payload,
        fallbackForStatus(response.status, "Could not send that message. Please try again."),
      ),
      response.status,
      asCode(payload),
    );
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: AiChatSuccessResponse | null = null;
  let streamError: AiChatRequestError | null = null;

  const handleEvent = (event: AiChatStreamEvent) => {
    if (event.type === "meta") {
      handlers.onSession?.(event.sessionId);
      return;
    }
    if (event.type === "delta") {
      handlers.onDelta?.(event.text);
      return;
    }
    if (event.type === "done") {
      handlers.onSession?.(event.sessionId);
      result = {
        ok: true,
        sessionId: event.sessionId,
        message: event.message,
        cta: event.cta,
      };
      return;
    }
    streamError = new AiChatRequestError(event.error, 500, event.code ?? "dify");
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      const event = parseStreamEvent(line);
      if (event) {
        handleEvent(event);
      }
      newline = buffer.indexOf("\n");
    }
  }

  buffer += decoder.decode();
  const leftover = parseStreamEvent(buffer);
  if (leftover) {
    handleEvent(leftover);
  }

  if (streamError) {
    throw streamError;
  }
  if (result) {
    return result;
  }

  throw new AiChatRequestError(
    "The assistant could not complete that reply. Please try again.",
    502,
    "dify",
  );
}

/**
 * Deletes the current conversation through the server bridge: the server
 * removes the website-side session with its messages and, when it can, the
 * matching Dify conversation. The local session id is forgotten either way, so
 * no message from the deleted thread can reappear.
 */
export async function deleteAiConversation(sessionId: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(AI_CHAT_ENDPOINT, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify({ sessionId }),
    });
  } catch {
    throw new AiChatRequestError(
      "Could not reach the assistant. Check your connection and try again.",
      0,
      "network",
    );
  }

  // 404 means it is already gone, which is the outcome we wanted.
  if (response.ok || response.status === 404) {
    clearStoredAiSessionId();
    // Drop the cached conversation too, so navigating away and back can never
    // resurrect the messages that were just deleted.
    clearAiHistoryCache();
    return;
  }

  const payload = await readJson(response);
  throw new AiChatRequestError(
    asError(
      payload,
      fallbackForStatus(response.status, "Could not delete that conversation. Please try again."),
    ),
    response.status,
    asCode(payload),
  );
}

/**
 * Starts a fresh conversation. Forgetting the stored session id is enough: the
 * next message creates a new website session and, with it, a new Dify
 * conversation, so nothing from the previous thread carries over.
 */
export function startNewAiConversation(): void {
  clearStoredAiSessionId();
  // The previous conversation must not be cached under the new one's identity.
  clearAiHistoryCache();
}

export async function loadAiChatHistory(
  sessionId: string,
): Promise<AiChatHistoryResponse> {
  const url = `${AI_CHAT_ENDPOINT}?sessionId=${encodeURIComponent(sessionId)}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new AiChatRequestError(
      "Could not reach the assistant. Check your connection and try again.",
      0,
      "network",
    );
  }

  const payload = await readJson(response);
  if (
    response.ok &&
    payload &&
    typeof payload === "object" &&
    "ok" in payload &&
    (payload as AiChatHistoryResponse).ok === true &&
    "messages" in payload
  ) {
    return payload as AiChatHistoryResponse;
  }

  throw new AiChatRequestError(
    asError(payload, fallbackForStatus(response.status, "Could not load that conversation.")),
    response.status,
    asCode(payload),
  );
}

function isAiUiConfigPayload(payload: unknown): payload is AiUiConfigResponse {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const value = payload as Partial<AiUiConfigResponse>;
  return (
    value.ok === true &&
    typeof value.name === "string" &&
    typeof value.openingMessage === "string" &&
    typeof value.inputPlaceholder === "string" &&
    Array.isArray(value.suggestedQuestions)
  );
}

/** Dify's own avatar URL: absolute http(s) only, never resolved against us. */
function asAvatarUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const raw = value.trim();
  if (!/^https?:\/\//i.test(raw)) {
    return null;
  }
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** An emoji icon (short, not a URL). */
function asAvatarEmoji(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const raw = value.trim();
  if (!raw || raw.length > 16 || /^https?:\/\//i.test(raw)) {
    return null;
  }
  return raw;
}

/**
 * Dify's UI configuration is cached separately from chat history, so moving
 * between pages does not re-ask Dify for Nora's name/avatar/welcome/questions.
 */
export async function loadAiUiConfig(): Promise<AiUiConfig> {
  const cached = readAiConfigCache();
  if (cached) {
    return cached;
  }

  const fresh = await fetchAiUiConfig();
  if (fresh.configSource === "dify") {
    writeAiConfigCache(fresh);
  }
  return fresh;
}

/**
 * Like `loadAiUiConfig`, but never blocks on the network: a stale cached
 * configuration is returned immediately (so the page renders instantly) while
 * the fresh copy is fetched and cached in the background. Only used by the UI,
 * which then swaps in the new values when they arrive.
 */
export function readStaleAiConfigCache(): AiUiConfig | null {
  return readAiConfigCache({ allowStale: true });
}

async function fetchAiUiConfig(): Promise<AiUiConfig> {
  try {
    const response = await fetch(AI_CONFIG_ENDPOINT, {
      method: "GET",
      credentials: "same-origin",
    });
    const payload = await readJson(response);
    if (response.ok && isAiUiConfigPayload(payload)) {
      return {
        name: payload.name.trim() || DEFAULT_AI_UI_CONFIG.name,
        avatarUrl: asAvatarUrl(payload.avatarUrl),
        // Same-origin passthrough: accept only a site-relative path.
        avatarProxyUrl:
          typeof payload.avatarProxyUrl === "string" &&
          payload.avatarProxyUrl.startsWith("/api/ai/")
            ? payload.avatarProxyUrl
            : null,
        avatarEmoji: asAvatarEmoji(payload.avatarEmoji),
        avatarType:
          payload.avatarType === "emoji" || payload.avatarType === "image"
            ? payload.avatarType
            : null,
        avatarFileId: null,
        openingMessage: payload.openingMessage.trim() || DEFAULT_AI_UI_CONFIG.openingMessage,
        // Never invented: only what Dify returned, so an empty list hides the
        // suggested-questions section.
        suggestedQuestions: payload.suggestedQuestions
          .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          .map((item) => item.trim())
          .slice(0, 8),
        inputPlaceholder:
          payload.inputPlaceholder.trim() || DEFAULT_AI_UI_CONFIG.inputPlaceholder,
        themeColor:
          typeof payload.themeColor === "string" && payload.themeColor.trim()
            ? payload.themeColor.trim()
            : null,
        configSource: payload.configSource === "dify" ? "dify" : "fallback",
      };
    }
  } catch {
    // Configuration is decorative; chat must still work.
  }
  return DEFAULT_AI_UI_CONFIG;
}
