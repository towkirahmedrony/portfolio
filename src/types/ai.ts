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
};

export type AiChatResponse =
  | AiChatSuccessResponse
  | AiChatHistoryResponse
  | AiChatErrorResponse;
