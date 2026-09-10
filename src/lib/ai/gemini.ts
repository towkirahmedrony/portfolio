import { geminiApiKey, geminiModel, isGeminiConfigured } from "@/lib/ai/env";

const GEMINI_TIMEOUT_MS = 20_000;
const GEMINI_ORIGIN = "https://generativelanguage.googleapis.com/v1beta";

export type GeminiChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type GeminiStructuredReply = {
  message: string;
  showCta: boolean;
  ctaReason: string | null;
};

type GeminiPart = {
  text?: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
    finishReason?: string;
  }>;
  error?: {
    message?: string;
  };
};

function extractText(payload: GeminiResponse): string {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();
}

function stripFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced?.[1] ?? text).trim();
}

function parseStructuredReply(raw: string): GeminiStructuredReply | null {
  const text = stripFence(raw);
  if (!text) {
    return null;
  }

  try {
    const parsed = JSON.parse(text) as {
      message?: unknown;
      showCta?: unknown;
      ctaReason?: unknown;
    };
    if (typeof parsed.message !== "string" || parsed.message.trim().length === 0) {
      return null;
    }

    return {
      message: parsed.message.trim(),
      showCta: parsed.showCta === true,
      ctaReason:
        typeof parsed.ctaReason === "string" && parsed.ctaReason.trim().length > 0
          ? parsed.ctaReason.trim()
          : null,
    };
  } catch {
    return {
      message: text,
      showCta: false,
      ctaReason: null,
    };
  }
}

export async function generateAssistantReply(input: {
  systemPrompt: string;
  history: GeminiChatTurn[];
  userMessage: string;
}): Promise<GeminiStructuredReply> {
  if (!isGeminiConfigured() || !geminiApiKey) {
    throw new Error("Gemini is not configured.");
  }

  const contents = [
    ...input.history.map((turn) => ({
      role: turn.role === "assistant" ? "model" : "user",
      parts: [{ text: turn.content }],
    })),
    {
      role: "user",
      parts: [{ text: input.userMessage }],
    },
  ];

  const endpoint = `${GEMINI_ORIGIN}/models/${encodeURIComponent(geminiModel)}:generateContent`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": geminiApiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: input.systemPrompt }],
      },
      contents,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
      },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
  });

  const body = await response.text();
  let payload: GeminiResponse;
  try {
    payload = JSON.parse(body) as GeminiResponse;
  } catch {
    throw new Error("Gemini returned a non-JSON body.");
  }

  if (!response.ok) {
    throw new Error(payload.error?.message || `Gemini API HTTP ${response.status}`);
  }

  const parsed = parseStructuredReply(extractText(payload));
  if (!parsed) {
    throw new Error("Gemini returned an empty reply.");
  }

  return parsed;
}
