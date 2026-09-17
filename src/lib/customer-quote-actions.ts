"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { supabaseUrl } from "@/lib/supabase/env";
import type { QuoteStatus } from "@/types/database";

export type ClientQuoteAction = "accept" | "reject" | "request_changes";

export type ClientQuoteActionResult =
  | { ok: true; status: QuoteStatus }
  | { ok: false; error: string };

const ACTION_VALUES: ClientQuoteAction[] = ["accept", "reject", "request_changes"];

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function isClientQuoteAction(value: string): value is ClientQuoteAction {
  return ACTION_VALUES.includes(value as ClientQuoteAction);
}

async function dispatchProjectConfirmationEmail(
  projectId: string,
  accessToken: string,
): Promise<void> {
  if (!supabaseUrl || !accessToken) return;
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-email-notification`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "project_confirmed", project_id: projectId }),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("Project confirmation email was not delivered", {
        projectId,
        status: response.status,
      });
    }
  } catch (error) {
    console.error("Project confirmation email request failed", {
      projectId,
      message: error instanceof Error ? error.message : "unknown",
    });
  }
}

function revalidateClientQuote(quoteId: string, projectId?: string | null, requestId?: string | null) {
  revalidatePath("/profile", "layout");
  revalidatePath("/admin/projects");
  if (projectId) {
    revalidatePath(`/profile/projects/${projectId}`);
    revalidatePath(`/admin/projects/${projectId}`);
  }
  if (requestId) {
    revalidatePath(`/profile/project-requests/${requestId}`);
    revalidatePath(`/admin/project-requests/${requestId}`);
  }
  revalidatePath("/admin/quotes");
  revalidatePath(`/admin/quotes/${quoteId}`);
  revalidatePath("/admin");
}

async function loadOwnedQuoteContext(
  quoteId: string,
  userId: string,
): Promise<
  | {
      ok: true;
      quote: {
        id: string;
        project_id: string | null;
        project_request_id: string | null;
        status: QuoteStatus;
        version: number;
      };
      projectId: string | null;
      requestId: string | null;
    }
  | { ok: false; error: string }
> {
  const supabase = await createServerSupabaseClient();
  const { data: quote, error } = await supabase
    .from("quotes")
    .select("id, project_id, project_request_id, status, version")
    .eq("id", quoteId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message || "Could not load this quote." };
  }
  if (!quote) {
    return { ok: false, error: "Quote not found." };
  }

  let requestId = quote.project_request_id;
  const projectId = quote.project_id;
  let owns = false;

  if (requestId) {
    const { data: request } = await supabase
      .from("project_requests")
      .select("id, client_id")
      .eq("id", requestId)
      .eq("client_id", userId)
      .maybeSingle();
    owns = Boolean(request);
  }

  if (!owns && projectId) {
    const { data: project } = await supabase
      .from("projects")
      .select("id, client_id, request_id")
      .eq("id", projectId)
      .eq("client_id", userId)
      .maybeSingle();
    if (project) {
      owns = true;
      requestId = requestId || project.request_id;
    }
  }

  if (!owns) {
    return { ok: false, error: "Quote not found." };
  }

  return { ok: true, quote, projectId, requestId };
}

export async function respondToOwnQuote(
  formData: FormData,
): Promise<ClientQuoteActionResult> {
  const quoteId = asString(formData.get("quoteId"));
  const actionRaw = asString(formData.get("action"));
  const message = asString(formData.get("message"));

  if (!quoteId) {
    return { ok: false, error: "Missing quote." };
  }
  if (!isClientQuoteAction(actionRaw)) {
    return { ok: false, error: "Invalid quote action." };
  }
  if (actionRaw === "request_changes" && !message) {
    return { ok: false, error: "Please describe the changes you need." };
  }
  if (message.length > 2000) {
    return { ok: false, error: "Message is too long." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You need to be signed in." };
  }

  const context = await loadOwnedQuoteContext(quoteId, user.id);
  if (!context.ok) {
    return { ok: false, error: context.error };
  }
  const wasAlreadyAccepted = context.quote.status === "accepted";

  if (context.quote.status === "sent") {
    await supabase.rpc("client_mark_quote_viewed", {
      p_quote_id: quoteId,
    });
  }

  const { data, error } = await supabase.rpc("client_respond_to_quote", {
    p_quote_id: quoteId,
    p_action: actionRaw,
    p_message: message || undefined,
  });

  if (error) {
    return {
      ok: false,
      error: error.message || "Could not update this quote.",
    };
  }

  let projectId = context.projectId;
  if (actionRaw === "accept" && !projectId && context.requestId) {
    const { data: createdProject } = await supabase
      .from("projects")
      .select("id")
      .eq("request_id", context.requestId)
      .maybeSingle();
    projectId = createdProject?.id ?? projectId;
  }

  if (actionRaw === "accept" && !wasAlreadyAccepted && projectId) {
    const { data: sessionData } = await supabase.auth.getSession();
    await dispatchProjectConfirmationEmail(projectId, sessionData.session?.access_token ?? "");
  }

  revalidateClientQuote(quoteId, projectId, context.requestId);
  return { ok: true, status: data as QuoteStatus };
}

export async function markOwnQuoteViewed(quoteId: string): Promise<void> {
  const trimmed = quoteId.trim();
  if (!trimmed) {
    return;
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return;
  }

  const context = await loadOwnedQuoteContext(trimmed, user.id);
  if (!context.ok) {
    return;
  }
  if (context.quote.status !== "sent") {
    return;
  }

  await supabase.rpc("client_mark_quote_viewed", {
    p_quote_id: trimmed,
  });
}
