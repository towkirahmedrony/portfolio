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

export type AiUiConfig = {
  name: string;
  avatar: string | null;
  avatarType: AiUiAvatarType | null;
  welcomeMessage: string;
  suggestedQuestions: string[];
  inputPlaceholder: string;
  themeColor: string | null;
};

export type AiUiConfigResponse = AiUiConfig & {
  ok: true;
};
