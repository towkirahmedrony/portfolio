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
  avatar: string | null;
  avatarType: AiUiAvatarType | null;
  welcomeMessage: string;
  suggestedQuestions: string[];
  inputPlaceholder: string;
  themeColor: string | null;
  configSource: AiUiConfigSource;
};

export type AiUiConfigResponse = AiUiConfig & {
  ok: true;
};
