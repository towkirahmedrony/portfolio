import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendMail } from "./smtp.ts";

type NotificationType =
  | "project_confirmed"
  | "project_status_changed"
  | "project_request_status_changed";

type Payload = {
  project_id?: string;
  request_id?: string;
  type?: NotificationType;
  previous_status?: string;
  new_status?: string;
  notification_id?: string;
};

type Project = {
  id: string;
  project_number: string;
  title: string;
  status: string;
  currency: string | null;
  agreed_price: number | string | null;
  client_id: string;
};

type ProjectRequest = {
  id: string;
  request_number: string;
  full_name: string;
  email: string | null;
  status: string;
  client_id: string | null;
};

const prefix = "[email-notification]";

const SUPPORTED_TYPES: NotificationType[] = [
  "project_confirmed",
  "project_status_changed",
  "project_request_status_changed",
];

const STATUS_TRANSITION_TYPES: NotificationType[] = [
  "project_status_changed",
  "project_request_status_changed",
];

const out = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const ms = (t: number) => Math.round(performance.now() - t);

const esc = (v: unknown) =>
  String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const label = (v: string) =>
  v.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

const log = (event: string, id: string, meta: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ message: `${prefix} ${event}`, request_id: id, ...meta }));

/** Plain-text alternative derived from the rendered HTML. */
const htmlToText = (html: string): string =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h1|table)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const layout = (
  title: string,
  intro: string,
  body: string,
  url: string,
  linkLabel = "Open project",
) =>
  `<!doctype html><html><body style="margin:0;background:#f5f4ef;color:#20211f;font-family:Arial,sans-serif;line-height:1.55"><div style="max-width:620px;margin:32px auto;padding:0 16px"><div style="background:#173f35;color:#fff;padding:22px 28px;border-radius:14px 14px 0 0"><strong>Shakib Shahriar</strong><div style="font-size:12px;opacity:.78;margin-top:4px">Freelance Web Developer</div></div><div style="background:#fff;padding:30px 28px;border:1px solid #e3e1d9;border-top:0;border-radius:0 0 14px 14px"><h1>${esc(title)}</h1><p>${esc(intro)}</p>${body}<p><a href="${esc(url)}" style="display:inline-block;background:#173f35;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px">${esc(linkLabel)}</a></p><p style="font-size:12px;color:#777">This is a transactional notification about your project. Please reply to the original conversation if you need help.</p></div></div></body></html>`;

Deno.serve(async (req: Request) => {
  const id = crypto.randomUUID();
  const total = performance.now();
  const finish = (event: string, meta: Record<string, unknown> = {}) =>
    log(event, id, { ...meta, total_elapsed_ms: ms(total) });

  log("request_received", id, {
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  if (req.method !== "POST") {
    finish("email_notification_failed", {
      stage: "request",
      error_category: "method_not_allowed",
    });
    return out({ success: false, error: "Method not allowed" }, 405);
  }

  // ---------------------------------------------------------------- auth
  const authT = performance.now();
  log("authentication_started", id);

  const su = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!su || !key) {
    log("authentication_failed", id, {
      reason: "server_configuration_incomplete",
      elapsed_ms: ms(authT),
    });
    finish("email_notification_failed", {
      stage: "authentication",
      error_category: "server_configuration_incomplete",
    });
    return out({ success: false, error: "Server configuration incomplete" }, 500);
  }

  const db = createClient(su, key, { auth: { persistSession: false } });

  // Server-to-server dispatch (pg_net) authenticates with the vault webhook secret.
  let internal = false;
  const internalHeader = req.headers.get("x-email-notification-secret");
  if (internalHeader) {
    const check = await db.rpc("get_email_notification_webhook_secret");
    internal = check.data === internalHeader;
  }

  const bearer = req.headers.get("authorization");
  if (!internal && !bearer?.toLowerCase().startsWith("bearer ")) {
    log("authentication_failed", id, {
      reason: "missing_bearer_token",
      elapsed_ms: ms(authT),
    });
    finish("email_notification_failed", {
      stage: "authentication",
      error_category: "unauthorized",
    });
    return out({ success: false, error: "Unauthorized" }, 401);
  }

  let authUserId: string | null = null;
  if (!internal) {
    const { data, error } = await db.auth.getUser(bearer!.slice(7));
    if (error || !data.user) {
      log("authentication_failed", id, {
        reason: "invalid_token",
        elapsed_ms: ms(authT),
      });
      finish("email_notification_failed", {
        stage: "authentication",
        error_category: "unauthorized",
      });
      return out({ success: false, error: "Unauthorized" }, 401);
    }
    authUserId = data.user.id;
  }

  log("authentication_success", id, {
    user_id_present: Boolean(authUserId),
    server_to_server: internal,
    elapsed_ms: ms(authT),
  });

  // ------------------------------------------------- payload validation
  const payloadT = performance.now();
  log("payload_validation_started", id);

  let p: Payload;
  try {
    p = await req.json();
  } catch {
    log("payload_validation_failed", id, {
      reason: "invalid_json",
      elapsed_ms: ms(payloadT),
    });
    finish("email_notification_failed", {
      stage: "payload_validation",
      error_category: "invalid_json",
    });
    return out({ success: false, error: "Invalid JSON" }, 400);
  }

  const type = p.type;
  if (!type || !SUPPORTED_TYPES.includes(type)) {
    log("payload_validation_failed", id, {
      reason: "missing_or_unsupported_fields",
      notification_type: type ?? null,
      project_id_present: Boolean(p.project_id),
      request_id_present: Boolean(p.request_id),
      user_id_present: Boolean(authUserId),
      elapsed_ms: ms(payloadT),
    });
    finish("email_notification_failed", {
      stage: "payload_validation",
      error_category: "invalid_payload",
    });
    return out({ success: false, error: "Unsupported notification" }, 400);
  }

  const isRequestType = type === "project_request_status_changed";

  if (isRequestType && !p.request_id) {
    log("payload_validation_failed", id, {
      reason: "missing_request_id",
      notification_type: type,
      elapsed_ms: ms(payloadT),
    });
    finish("email_notification_failed", {
      stage: "payload_validation",
      error_category: "invalid_payload",
    });
    return out({ success: false, error: "Request id is required" }, 400);
  }

  if (!isRequestType && !p.project_id) {
    log("payload_validation_failed", id, {
      reason: "missing_project_id",
      notification_type: type,
      elapsed_ms: ms(payloadT),
    });
    finish("email_notification_failed", {
      stage: "payload_validation",
      error_category: "invalid_payload",
    });
    return out({ success: false, error: "Project id is required" }, 400);
  }

  if (STATUS_TRANSITION_TYPES.includes(type) && (!p.previous_status || !p.new_status)) {
    log("payload_validation_failed", id, {
      reason: "missing_status_transition",
      notification_type: type,
      elapsed_ms: ms(payloadT),
    });
    finish("email_notification_failed", {
      stage: "payload_validation",
      error_category: "invalid_status_transition",
    });
    return out({ success: false, error: "Status transition is required" }, 400);
  }

  log("payload_validation_success", id, {
    notification_type: type,
    project_id_present: Boolean(p.project_id),
    request_id_present: Boolean(p.request_id),
    user_id_present: Boolean(authUserId),
    elapsed_ms: ms(payloadT),
  });
  log("notification_type_resolved", id, { notification_type: type });

  // ------------------------------------------------------ resolve context
  let recipientEmail: string | null = null;
  let preferenceUserId: string | null = null;
  let subject: string;
  let html: string;

  const site = Deno.env.get("SITE_URL") ?? "https://shakib-shahriar.vercel.app";
  const baseSite = site.replace(/\/$/, "");

  const lookupT = performance.now();
  const authT2 = performance.now();
  let profiles: { role?: string | null; status?: string | null } | null = null;

  if (!internal && authUserId) {
    const profile = await db
      .from("profiles")
      .select("role,status")
      .eq("id", authUserId)
      .maybeSingle();
    profiles = (profile.data as { role?: string | null; status?: string | null } | null) ?? null;
  }
  const activeAdmin = profiles?.role === "admin" && profiles?.status === "active";

  if (isRequestType) {
    // -------------------------------------------- project request branch
    log("project_request_lookup_started", id, { request_id: p.request_id });

    const result = await db
      .from("project_requests")
      .select("id, request_number, full_name, email, status, client_id")
      .eq("id", p.request_id)
      .maybeSingle<ProjectRequest>();

    if (result.error || !result.data) {
      log("project_request_lookup_failed", id, {
        request_id: p.request_id,
        reason: result.error ? "database_error" : "not_found",
        elapsed_ms: ms(lookupT),
      });
      finish("email_notification_failed", {
        stage: "project_request_lookup",
        error_category: result.error ? "database_error" : "request_not_found",
      });
      return out({ success: false, error: "Project request not found" }, 404);
    }

    const request = result.data;
    log("project_request_lookup_success", id, {
      request_id: request.id,
      request_number: request.request_number,
      current_status: request.status,
      has_linked_client: Boolean(request.client_id),
      has_linked_project: Boolean(p.project_id),
      elapsed_ms: ms(lookupT),
    });

    log("authorization_started", id);
    const owner = Boolean(
      authUserId && request.client_id && request.client_id === authUserId,
    );
    if (!internal && !owner && !activeAdmin) {
      log("authorization_failed", id, {
        authenticated_user: Boolean(authUserId),
        request_owner: owner,
        active_admin: activeAdmin,
        reason: "unauthorized_user",
      });
      finish("email_notification_failed", {
        stage: "authorization",
        error_category: "forbidden",
      });
      return out({ success: false, error: "Forbidden" }, 403);
    }
    log("authorization_success", id, {
      authenticated_user: Boolean(authUserId ?? internal),
      request_owner: owner,
      active_admin: activeAdmin,
      server_to_server: internal,
      elapsed_ms: ms(authT2),
    });

    // Recipient comes from the request's own production data; the linked
    // client profile is only a fallback when the request has no email.
    const emailT = performance.now();
    log("customer_email_lookup_started", id);
    let email = (request.email ?? "").trim();
    let emailSource = "request";
    if (!email && request.client_id) {
      const recipient = await db.auth.admin.getUserById(request.client_id);
      email = recipient.data.user?.email?.trim() ?? "";
      emailSource = "client_profile";
    }
    if (!email) {
      log("customer_email_lookup_failed", id, {
        email_found: false,
        elapsed_ms: ms(emailT),
      });
      finish("email_notification_failed", {
        stage: "customer_email_lookup",
        error_category: "recipient_email_unavailable",
      });
      return out({ success: false, error: "Recipient email unavailable" }, 422);
    }
    log("customer_email_lookup_success", id, {
      email_found: true,
      email_source: emailSource,
      elapsed_ms: ms(emailT),
    });

    recipientEmail = email;
    preferenceUserId = request.client_id;

    const rows =
      `<tr><td>Previous status</td><td>${esc(label(p.previous_status!))}</td></tr>` +
      `<tr><td>New status</td><td>${esc(label(p.new_status!))}</td></tr>`;
    const details =
      `<table><tr><td>Request</td><td>${esc(request.request_number)}</td></tr>${rows}</table>`;

    subject = `Project request status updated — ${request.request_number}`;
    html = layout(
      "Project request status updated",
      `Your project request status changed from ${label(p.previous_status!)} to ${label(p.new_status!)}.`,
      details,
      `${baseSite}/profile/project-requests/${encodeURIComponent(request.id)}`,
      "Open request",
    );
  } else {
    // --------------------------------------------------- project branch
    log("project_lookup_started", id, { project_id: p.project_id });

    const result = await db
      .from("projects")
      .select("id, project_number, title, status, currency, agreed_price, client_id")
      .eq("id", p.project_id)
      .maybeSingle<Project>();

    if (result.error || !result.data) {
      log("project_lookup_failed", id, {
        project_id: p.project_id,
        reason: result.error ? "database_error" : "not_found",
        elapsed_ms: ms(lookupT),
      });
      finish("email_notification_failed", {
        stage: "project_lookup",
        error_category: result.error ? "database_error" : "project_not_found",
      });
      return out({ success: false, error: "Project not found" }, 404);
    }

    const project = result.data;
    log("project_lookup_success", id, {
      project_id: project.id,
      project_number: project.project_number,
      current_status: project.status,
      elapsed_ms: ms(lookupT),
    });

    log("authorization_started", id);
    const owner = Boolean(authUserId && project.client_id === authUserId);
    if (!internal && !owner && !activeAdmin) {
      log("authorization_failed", id, {
        authenticated_user: Boolean(authUserId),
        project_owner: owner,
        active_admin: activeAdmin,
        reason: "unauthorized_user",
      });
      finish("email_notification_failed", {
        stage: "authorization",
        error_category: "forbidden",
      });
      return out({ success: false, error: "Forbidden" }, 403);
    }
    log("authorization_success", id, {
      authenticated_user: Boolean(authUserId ?? internal),
      project_owner: owner,
      active_admin: activeAdmin,
      server_to_server: internal,
      elapsed_ms: ms(authT2),
    });

    const emailT = performance.now();
    log("customer_email_lookup_started", id);
    const recipient = await db.auth.admin.getUserById(project.client_id);
    const email = recipient.data.user?.email?.trim() ?? "";
    if (!email) {
      log("customer_email_lookup_failed", id, {
        email_found: false,
        elapsed_ms: ms(emailT),
      });
      finish("email_notification_failed", {
        stage: "customer_email_lookup",
        error_category: "recipient_email_unavailable",
      });
      return out({ success: false, error: "Recipient email unavailable" }, 422);
    }
    log("customer_email_lookup_success", id, {
      email_found: true,
      email_source: "client_profile",
      elapsed_ms: ms(emailT),
    });

    recipientEmail = email;
    preferenceUserId = project.client_id;

    const amount =
      project.agreed_price == null
        ? null
        : `${esc(project.currency ?? "BDT")} ${esc(project.agreed_price)}`;
    const rows =
      type === "project_status_changed"
        ? `<tr><td>Previous status</td><td>${esc(label(p.previous_status!))}</td></tr>` +
          `<tr><td>New status</td><td>${esc(label(p.new_status!))}</td></tr>`
        : `<tr><td>Status</td><td>${esc(project.status)}</td></tr>` +
          (amount ? `<tr><td>Agreed amount</td><td>${amount}</td></tr>` : "");
    const details =
      `<table><tr><td>Project</td><td>${esc(project.title)}</td></tr>` +
      `<tr><td>Project number</td><td>${esc(project.project_number)}</td></tr>${rows}</table>`;

    const confirmed = type === "project_confirmed";
    subject = confirmed
      ? `Project confirmed — ${project.project_number}`
      : `Project status updated — ${project.project_number}`;
    html = layout(
      confirmed ? "Project confirmed" : "Project status updated",
      confirmed
        ? "Your final quote was accepted and your project is now confirmed."
        : `Your project status changed from ${label(p.previous_status!)} to ${label(p.new_status!)}.`,
      details,
      `${baseSite}/profile/projects/${encodeURIComponent(project.id)}`,
    );
  }

  const genT = performance.now();
  log("email_generation_started", id);
  log("email_generation_success", id, {
    notification_type: type,
    elapsed_ms: ms(genT),
  });

  // ----------------------------------------------------- preference gate
  const prefT = performance.now();
  log("preference_lookup_started", id);
  const pref = preferenceUserId
    ? await db
        .from("notification_preferences")
        .select("email_project_updates")
        .eq("user_id", preferenceUserId)
        .maybeSingle()
    : { data: null };
  const enabled =
    (pref.data as { email_project_updates?: boolean } | null)?.email_project_updates !== false;
  log("preference_lookup_result", id, {
    email_project_updates: enabled,
    elapsed_ms: ms(prefT),
  });
  if (!enabled) {
    log("email_skipped_preference_disabled", id);
    finish("email_notification_skipped", { reason: "preference_disabled" });
    return out({ success: true, skipped: true, reason: "preference_disabled" });
  }

  // ------------------------------------------------------ delivery
  // Primary transport: Gmail SMTP, reusing the same Gmail account as the
  // project's Supabase Auth Custom SMTP. Credentials live only in Edge
  // Function secrets and are never logged, returned or echoed.
  const smtpHost = Deno.env.get("SMTP_HOST")?.trim() ?? "";
  const smtpPort = Number(Deno.env.get("SMTP_PORT")?.trim() ?? "465");
  const smtpUser = Deno.env.get("SMTP_USER")?.trim() ?? "";
  const smtpPass = Deno.env.get("SMTP_PASS") ?? "";
  const smtpFrom = Deno.env.get("SMTP_FROM")?.trim() || smtpUser;
  const smtpFromName =
    Deno.env.get("SMTP_FROM_NAME")?.trim() || "Shakib Shahriar";
  const smtpConfigured = Boolean(
    smtpHost && smtpUser && smtpPass && Number.isFinite(smtpPort),
  );
  log("email_transport_selected", id, {
    transport: smtpConfigured ? "gmail_smtp" : "none",
    smtp_configured: smtpConfigured,
    smtp_port: smtpConfigured ? smtpPort : null,
    implicit_tls: smtpPort === 465,
  });

  if (!smtpConfigured) {
    finish("email_notification_failed", {
      stage: "delivery_configuration",
      error_category: "configuration_missing",
    });
    return out(
      { success: false, error: "Email delivery is not configured" },
      503,
    );
  }

  if (smtpConfigured) {
    const smtpT = performance.now();
    const maxSmtpAttempts = 2;
    for (let attempt = 1; attempt <= maxSmtpAttempts; attempt++) {
      log("smtp_send_started", id, {
        attempt,
        max_attempts: maxSmtpAttempts,
        port: smtpPort,
        implicit_tls: smtpPort === 465,
      });

      const result = await sendMail(
        {
          host: smtpHost,
          port: smtpPort,
          user: smtpUser,
          pass: smtpPass,
          fromName: smtpFromName,
        },
        {
          from: smtpFrom,
          to: recipientEmail!,
          replyTo: smtpFrom,
          subject,
          html,
          text: htmlToText(html),
        },
      );

      if (result.ok) {
        log("smtp_send_success", id, { attempt, elapsed_ms: ms(smtpT) });
        finish("email_notification_success", {
          notification_type: type,
          transport: "gmail_smtp",
          attempts: attempt,
        });
        return out({ success: true, transport: "gmail_smtp" });
      }

      log("smtp_send_failed", id, {
        attempt,
        stage: result.stage,
        status: result.status ?? null,
        retryable: result.retryable,
        server_message: result.message,
        elapsed_ms: ms(smtpT),
      });

      if (!result.retryable || attempt === maxSmtpAttempts) {
        finish("email_notification_failed", {
          stage: `smtp_${result.stage}`,
          error_category: "delivery_failed",
          transport: "gmail_smtp",
        });
        return out({ success: false, error: "Email delivery failed" }, 502);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  // SMTP-only transport: every path above returns, so this is unreachable.
  finish("email_notification_failed", {
    stage: "delivery_configuration",
    error_category: "delivery_failed",
  });
  return out({ success: false, error: "Email delivery failed" }, 502);
});
