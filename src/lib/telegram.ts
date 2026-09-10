import { site } from "@/data/site";
import { formatStatusLabel } from "@/lib/admin-project-constants";
import {
  displaySlug,
  formatRequestBudget,
  formatRequestDeadline,
  formatRequestStatusLabel,
} from "@/lib/admin-project-request-constants";

const LOG_PREFIX = "[telegram]";
const TELEGRAM_API_ORIGIN = "https://api.telegram.org";
const TELEGRAM_FETCH_TIMEOUT_MS = 8_000;
const TELEGRAM_TEXT_LIMIT = 4_000;
const ERROR_BODY_LOG_LIMIT = 500;

export type NewProjectRequestNotice = {
  id: string;
  requestNumber: string;
  fullName: string;
  email: string;
  phone: string | null;
  companyName: string | null;
  projectType: string | null;
  websiteStatus: string | null;
  pageCount: number | null;
  description: string | null;
  requiredFeatures: string[] | null;
  budgetMin: number | null;
  budgetMax: number | null;
  budgetCurrency: string | null;
  deadlineType: string | null;
  deadlineDate: string | null;
  referralCode: string | null;
};

export type NewContactMessageNotice = {
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
};

export type ClientChatMessageNotice = {
  conversation: "request" | "project";
  contextId: string;
  reference: string;
  title: string | null;
  status: string | null;
  clientName: string;
  email: string | null;
  phone: string | null;
  message: string;
  messageId: string;
};

type TelegramSendContext = {
  kind: "project-request" | "contact-message" | "client-chat";
  id?: string;
  requestNumber?: string;
};

type TelegramConfig = {
  token: string | null;
  chatId: string | null;
  missing: string[];
  configured: boolean;
};

function maskChatId(chatId: string): string {
  const trimmed = chatId.trim();
  if (trimmed.length <= 4) {
    return `len=${trimmed.length}`;
  }
  return `len=${trimmed.length}, ends=${trimmed.slice(-4)}`;
}

function readTelegramConfig(): TelegramConfig {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim() || null;
  const missing: string[] = [];

  if (!token) {
    missing.push("TELEGRAM_BOT_TOKEN");
  }
  if (!chatId) {
    missing.push("TELEGRAM_CHAT_ID");
  }

  return {
    token,
    chatId,
    missing,
    configured: missing.length === 0,
  };
}

function line(label: string, value: string | number | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value === "string" && value.trim().length === 0) {
    return null;
  }
  return `${label}: ${value}`;
}

function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, Math.max(0, max - 3))}...`;
}

function buildNewProjectRequestMessage(notice: NewProjectRequestNotice): string {
  const budget = formatRequestBudget(
    notice.budgetMin,
    notice.budgetMax,
    notice.budgetCurrency ?? "BDT",
  );
  const deadline = formatRequestDeadline(notice.deadlineDate, notice.deadlineType);
  const features = (notice.requiredFeatures ?? []).filter((item) => item.trim().length > 0);
  const adminUrl = new URL(`/admin/project-requests/${notice.id}`, site.url).toString();

  const lines = [
    "New project request",
    "",
    line("Request", notice.requestNumber),
    line("Name", notice.fullName),
    line("Email", notice.email),
    line("Phone", notice.phone),
    line("Company", notice.companyName),
    line("Project type", displaySlug(notice.projectType)),
    line("Website status", displaySlug(notice.websiteStatus)),
    line("Pages", notice.pageCount),
    line("Budget", budget === "Not specified" ? null : budget),
    line("Deadline", deadline === "—" ? null : deadline),
    line("Referral", notice.referralCode),
    features.length > 0 ? `Features: ${features.join(", ")}` : null,
  ].filter((item): item is string => Boolean(item));

  const description = notice.description?.trim();
  if (description) {
    lines.push("", "Description:", truncate(description, 1_200));
  }

  lines.push("", "Admin:", adminUrl);
  return truncate(lines.join("\n"), TELEGRAM_TEXT_LIMIT);
}

function buildNewContactMessage(notice: NewContactMessageNotice): string {
  const adminUrl = new URL("/admin/contact-messages", site.url).toString();
  const lines = [
    "New contact message",
    "",
    line("Name", notice.name),
    line("Email", notice.email),
    line("Phone", notice.phone),
    line("Subject", notice.subject),
  ].filter((item): item is string => Boolean(item));

  const message = notice.message.trim();
  if (message) {
    lines.push("", "Message:", truncate(message, 1_200));
  }

  lines.push("", "Admin:", adminUrl);
  return truncate(lines.join("\n"), TELEGRAM_TEXT_LIMIT);
}

function buildClientChatMessage(notice: ClientChatMessageNotice): string {
  const chatPath =
    notice.conversation === "request"
      ? `/admin/project-requests/${notice.contextId}/messages`
      : `/admin/projects/${notice.contextId}/messages`;
  const adminUrl = new URL(chatPath, site.url).toString();
  const statusLabel =
    notice.conversation === "request"
      ? formatRequestStatusLabel(notice.status ?? "")
      : formatStatusLabel(notice.status ?? "");
  const contextLabel = notice.conversation === "request" ? "Request" : "Project";
  const titleLabel = notice.conversation === "request" ? "Type" : "Title";

  const lines = [
    notice.conversation === "request"
      ? "New client message (project request)"
      : "New client message (project)",
    "",
    line(contextLabel, notice.reference),
    line(
      titleLabel,
      notice.conversation === "request" ? displaySlug(notice.title) : notice.title,
    ),
    line("Status", notice.status ? statusLabel : null),
    line("Name", notice.clientName),
    line("Email", notice.email),
    line("Phone", notice.phone),
  ].filter((item): item is string => Boolean(item));

  const message = notice.message.trim();
  if (message) {
    lines.push("", "Message:", truncate(message, 1_200));
  }

  lines.push("", "Admin chat:", adminUrl);
  return truncate(lines.join("\n"), TELEGRAM_TEXT_LIMIT);
}

async function readResponseBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch (error) {
    return error instanceof Error ? error.message : "Unable to read Telegram response body.";
  }
}

async function sendTelegramMessage(
  text: string,
  context: TelegramSendContext,
): Promise<void> {
  console.info(`${LOG_PREFIX} notification triggered`, {
    kind: context.kind,
    requestId: context.id,
    requestNumber: context.requestNumber,
  });

  const config = readTelegramConfig();
  console.info(`${LOG_PREFIX} Telegram configuration detected`, {
    tokenConfigured: Boolean(config.token),
    tokenLength: config.token?.length ?? 0,
    chatIdConfigured: Boolean(config.chatId),
    chatId: config.chatId ? maskChatId(config.chatId) : null,
    missing: config.missing,
  });

  if (!config.configured || !config.token || !config.chatId) {
    console.warn(`${LOG_PREFIX} skipped: missing or empty environment variables`, {
      missing: config.missing,
    });
    return;
  }

  const endpoint = `${TELEGRAM_API_ORIGIN}/bot${config.token}/sendMessage`;

  console.info(`${LOG_PREFIX} Telegram API request started`, {
    method: "sendMessage",
    kind: context.kind,
    requestId: context.id,
  });

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chatId,
        text,
        disable_web_page_preview: true,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(TELEGRAM_FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} Telegram API request failed`, {
      kind: context.kind,
      requestId: context.id,
      error: error instanceof Error ? error.message : "unknown error",
    });
    throw error;
  }

  const body = await readResponseBody(response);
  console.info(`${LOG_PREFIX} Telegram API response status`, {
    kind: context.kind,
    requestId: context.id,
    status: response.status,
    ok: response.ok,
  });

  if (!response.ok) {
    console.error(`${LOG_PREFIX} Telegram API error body`, {
      kind: context.kind,
      requestId: context.id,
      status: response.status,
      body: truncate(body, ERROR_BODY_LOG_LIMIT),
    });
    throw new Error(`Telegram API HTTP ${response.status}`);
  }

  let parsed: { ok?: unknown; description?: unknown } | null = null;
  try {
    parsed = JSON.parse(body) as { ok?: unknown; description?: unknown };
  } catch {
    console.error(`${LOG_PREFIX} Telegram API error body`, {
      kind: context.kind,
      requestId: context.id,
      status: response.status,
      body: truncate(body, ERROR_BODY_LOG_LIMIT),
    });
    throw new Error("Telegram API returned a non-JSON body.");
  }

  if (parsed.ok !== true) {
    const description =
      typeof parsed.description === "string" ? parsed.description : "unknown Telegram error";
    console.error(`${LOG_PREFIX} Telegram API error body`, {
      kind: context.kind,
      requestId: context.id,
      status: response.status,
      body: truncate(body, ERROR_BODY_LOG_LIMIT),
    });
    throw new Error(`Telegram API rejected sendMessage: ${description}`);
  }

  console.info(`${LOG_PREFIX} notification success`, {
    kind: context.kind,
    requestId: context.id,
    requestNumber: context.requestNumber,
  });
}

export async function notifyNewProjectRequest(
  notice: NewProjectRequestNotice,
): Promise<void> {
  await sendTelegramMessage(buildNewProjectRequestMessage(notice), {
    kind: "project-request",
    id: notice.id,
    requestNumber: notice.requestNumber,
  });
}

export async function notifyNewProjectRequestSafe(
  notice: NewProjectRequestNotice,
): Promise<void> {
  try {
    await notifyNewProjectRequest(notice);
  } catch (error) {
    console.error(`${LOG_PREFIX} notification failed (fail-open)`, {
      kind: "project-request",
      requestId: notice.id,
      requestNumber: notice.requestNumber,
      error: error instanceof Error ? error.message : "unknown error",
    });
  }
}

export async function notifyNewContactMessage(
  notice: NewContactMessageNotice,
): Promise<void> {
  await sendTelegramMessage(buildNewContactMessage(notice), {
    kind: "contact-message",
  });
}

export async function notifyNewContactMessageSafe(
  notice: NewContactMessageNotice,
): Promise<void> {
  try {
    await notifyNewContactMessage(notice);
  } catch (error) {
    console.error(`${LOG_PREFIX} notification failed (fail-open)`, {
      kind: "contact-message",
      error: error instanceof Error ? error.message : "unknown error",
    });
  }
}

export async function notifyClientChatMessage(
  notice: ClientChatMessageNotice,
): Promise<void> {
  await sendTelegramMessage(buildClientChatMessage(notice), {
    kind: "client-chat",
    id: notice.messageId,
    requestNumber: notice.reference,
  });
}

export async function notifyClientChatMessageSafe(
  notice: ClientChatMessageNotice,
): Promise<void> {
  try {
    await notifyClientChatMessage(notice);
  } catch (error) {
    console.error(`${LOG_PREFIX} notification failed (fail-open)`, {
      kind: "client-chat",
      requestId: notice.messageId,
      requestNumber: notice.reference,
      conversation: notice.conversation,
      error: error instanceof Error ? error.message : "unknown error",
    });
  }
}
