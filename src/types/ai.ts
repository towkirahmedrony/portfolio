export type AiMessageRole = "user" | "assistant";

export type AiCta = {
  label: string;
  href: string;
  reason: string | null;
};

export type AiChatMessage = {
  id: string;
  role: AiMessageRole;
  content: string;
  createdAt: string;
  cta: AiCta | null;
};

export type AiChatSuccessResponse = {
  ok: true;
  sessionId: string;
  message: AiChatMessage;
  cta: AiCta | null;
};

export type AiChatHistoryResponse = {
  ok: true;
  sessionId: string;
  messages: AiChatMessage[];
};

export type AiChatErrorResponse = {
  ok: false;
  error: string;
  code?: string;
};

export type AiChatStreamMetaEvent = {
  type: "meta";
  sessionId: string;
};

export type AiChatStreamDeltaEvent = {
  type: "delta";
  text: string;
};

export type AiChatStreamDoneEvent = {
  type: "done";
  sessionId: string;
  message: AiChatMessage;
  cta: AiCta | null;
};

export type AiChatStreamErrorEvent = {
  type: "error";
  error: string;
  code?: string;
};

export type AiChatStreamEvent =
  | AiChatStreamMetaEvent
  | AiChatStreamDeltaEvent
  | AiChatStreamDoneEvent
  | AiChatStreamErrorEvent;

export type AiChatResponse =
  | AiChatSuccessResponse
  | AiChatHistoryResponse
  | AiChatErrorResponse;

export type AiUiAvatarType = "emoji" | "image";

/**
 * Where a UI configuration came from: `dify` means Dify's live app
 * configuration answered, `fallback` means it was unreachable/unconfigured and
 * the neutral local defaults are in use. Suggested questions are never invented
 * either way — that list is empty unless Dify supplies it.
 */
export type AiUiConfigSource = "dify" | "fallback";

export type AiUiConfig = {
  name: string;
  /**
   * Dify's own avatar/icon URL, used exactly as Dify returned it (absolute
   * URLs verbatim; relative paths resolved against the Dify origin, never the
   * website origin). Null when Dify configures an emoji icon instead.
   */
  avatarUrl: string | null;
  /**
   * Same-origin passthrough for the avatar. Dify's cloud file URL is signed and
   * can be rejected by the browser ("File not found or signature is invalid"),
   * so the UI falls back to this route, which re-reads the icon server-side
   * with the API key. Null when there is no icon file behind the avatar.
   */
  avatarProxyUrl: string | null;
  /** Dify's emoji icon, when `icon_type` is `emoji`. */
  avatarEmoji: string | null;
  avatarType: AiUiAvatarType | null;
  /** Dify's icon file id (opaque), used by the avatar passthrough route. */
  avatarFileId: string | null;
  /** Dify's `opening_statement`. */
  openingMessage: string;
  suggestedQuestions: string[];
  inputPlaceholder: string;
  themeColor: string | null;
  configSource: AiUiConfigSource;
};

export type AiUiConfigResponse = AiUiConfig & {
  ok: true;
};
