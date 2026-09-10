"use server";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { notifyClientChatMessageSafe } from "@/lib/telegram";

const LOG_PREFIX = "[telegram]";
const notifiedMessageIds = new Set<string>();
const NOTIFIED_IDS_LIMIT = 500;

function rememberNotified(messageId: string): boolean {
  if (notifiedMessageIds.has(messageId)) {
    return false;
  }
  notifiedMessageIds.add(messageId);
  if (notifiedMessageIds.size > NOTIFIED_IDS_LIMIT) {
    const oldest = notifiedMessageIds.values().next().value;
    if (oldest) {
      notifiedMessageIds.delete(oldest);
    }
  }
  return true;
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Admin Telegram alert for a client chat message that is already stored.
 * Fail-open: never throws to the caller. Admin senders are ignored.
 */
export async function notifyAdminOfClientChatMessage(messageId: string): Promise<void> {
  const id = typeof messageId === "string" ? messageId.trim() : "";
  if (!id || !isSupabaseConfigured()) {
    return;
  }

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.info(`${LOG_PREFIX} client-chat notify skipped`, {
        reason: "unauthenticated",
      });
      return;
    }

    const { data: isAdmin } = await supabase.rpc("is_active_admin");
    if (isAdmin === true) {
      console.info(`${LOG_PREFIX} client-chat notify skipped`, {
        reason: "admin-sender",
        messageId: id,
      });
      return;
    }

    const { data: message, error: messageError } = await supabase
      .from("project_messages")
      .select("id, message, sender_id, project_id, request_id")
      .eq("id", id)
      .maybeSingle();

    if (messageError || !message) {
      console.warn(`${LOG_PREFIX} client-chat notify skipped`, {
        reason: "message-not-found",
        messageId: id,
        error: messageError?.message,
      });
      return;
    }

    if (message.sender_id !== user.id) {
      console.info(`${LOG_PREFIX} client-chat notify skipped`, {
        reason: "not-sender",
        messageId: id,
      });
      return;
    }

    const body = emptyToNull(message.message);
    if (!body) {
      return;
    }

    if (!rememberNotified(id)) {
      console.info(`${LOG_PREFIX} client-chat notify skipped`, {
        reason: "duplicate",
        messageId: id,
      });
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, display_name, phone")
      .eq("id", user.id)
      .maybeSingle();

    const profileName =
      emptyToNull(profile?.display_name) ?? emptyToNull(profile?.full_name);
    const profilePhone = emptyToNull(profile?.phone);
    const sessionEmail = emptyToNull(user.email);

    if (message.request_id) {
      const { data: request, error: requestError } = await supabase
        .from("project_requests")
        .select("id, request_number, project_type, status, full_name, email, phone")
        .eq("id", message.request_id)
        .maybeSingle();

      if (requestError || !request) {
        console.warn(`${LOG_PREFIX} client-chat notify skipped`, {
          reason: "request-not-found",
          messageId: id,
          error: requestError?.message,
        });
        return;
      }

      await notifyClientChatMessageSafe({
        conversation: "request",
        contextId: request.id,
        reference: request.request_number,
        title: emptyToNull(request.project_type),
        status: request.status,
        clientName: profileName ?? emptyToNull(request.full_name) ?? "Client",
        email: emptyToNull(request.email) ?? sessionEmail,
        phone: emptyToNull(request.phone) ?? profilePhone,
        message: body,
        messageId: message.id,
      });
      return;
    }

    if (message.project_id) {
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("id, project_number, title, status, request_id")
        .eq("id", message.project_id)
        .maybeSingle();

      if (projectError || !project) {
        console.warn(`${LOG_PREFIX} client-chat notify skipped`, {
          reason: "project-not-found",
          messageId: id,
          error: projectError?.message,
        });
        return;
      }

      let requestEmail: string | null = null;
      let requestPhone: string | null = null;
      let requestName: string | null = null;

      if (project.request_id) {
        const { data: request } = await supabase
          .from("project_requests")
          .select("full_name, email, phone")
          .eq("id", project.request_id)
          .maybeSingle();
        requestEmail = emptyToNull(request?.email);
        requestPhone = emptyToNull(request?.phone);
        requestName = emptyToNull(request?.full_name);
      }

      await notifyClientChatMessageSafe({
        conversation: "project",
        contextId: project.id,
        reference: project.project_number,
        title: emptyToNull(project.title),
        status: project.status,
        clientName: profileName ?? requestName ?? "Client",
        email: requestEmail ?? sessionEmail,
        phone: profilePhone ?? requestPhone,
        message: body,
        messageId: message.id,
      });
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} client-chat notify failed (fail-open)`, {
      messageId: id,
      error: error instanceof Error ? error.message : "unknown error",
    });
  }
}
