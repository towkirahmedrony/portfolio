import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type EmailRequest = {
  project_id?: string;
  type?: "project_confirmed" | "project_status_changed";
  previous_status?: string;
  new_status?: string;
};
type ProjectRow = {
  id: string;
  project_number: string;
  title: string;
  status: string;
  currency: string | null;
  agreed_price: number | string | null;
  client_id: string;
};

const PREFIX = "[email-notification]";
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const escapeHtml = (value: unknown) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const label = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
const elapsed = (started: number) => Math.round(performance.now() - started);
function log(event: string, requestId: string, metadata: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ message: `${PREFIX} ${event}`, request_id: requestId, ...metadata }));
}
const emailLayout = (title: string, intro: string, body: string, actionUrl: string | null) => `<!doctype html><html><body style="margin:0;background:#f5f4ef;color:#20211f;font-family:Arial,sans-serif;line-height:1.55"><div style="max-width:620px;margin:32px auto;padding:0 16px"><div style="background:#173f35;color:#fff;padding:22px 28px;border-radius:14px 14px 0 0"><strong>Shakib Shahriar</strong><div style="font-size:12px;opacity:.78;margin-top:4px">Freelance Web Developer</div></div><div style="background:#fff;padding:30px 28px;border:1px solid #e3e1d9;border-top:0;border-radius:0 0 14px 14px"><h1 style="font-size:24px;margin:0 0 12px">${escapeHtml(title)}</h1><p style="margin:0 0 22px">${escapeHtml(intro)}</p>${body}${actionUrl ? `<p style="margin:26px 0 4px"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#173f35;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px">Open project</a></p>` : ""}<p style="font-size:12px;color:#777;margin:30px 0 0">This is a transactional notification about your project. Please reply to the original conversation if you need help.</p></div></div></body></html>`;

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  const totalStarted = performance.now();
  log("request_received", requestId, { method: req.method, timestamp: new Date().toISOString() });
  const finish = (event: string, metadata: Record<string, unknown> = {}) => {
    log(event, requestId, { ...metadata, total_elapsed_ms: elapsed(totalStarted) });
  };
  if (req.method !== "POST") {
    finish("email_notification_failed", { stage: "request", error_category: "method_not_allowed" });
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  const authStarted = performance.now();
  log("authentication_started", requestId);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const appsScriptUrl = Deno.env.get("GOOGLE_APPS_SCRIPT_URL");
  const appsScriptSecret = Deno.env.get("GOOGLE_APPS_SCRIPT_SECRET");
  if (!supabaseUrl || !serviceRoleKey) {
    log("authentication_failed", requestId, { reason: "server_configuration_incomplete", elapsed_ms: elapsed(authStarted) });
    finish("email_notification_failed", { stage: "authentication", error_category: "server_configuration_incomplete" });
    return json({ success: false, error: "Server configuration incomplete" }, 500);
  }
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    log("authentication_failed", requestId, { reason: "missing_bearer_token", elapsed_ms: elapsed(authStarted) });
    finish("email_notification_failed", { stage: "authentication", error_category: "unauthorized" });
    return json({ success: false, error: "Unauthorized" }, 401);
  }
  const caller = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await caller.auth.getUser(authHeader.slice(7));
  if (authError || !authData.user) {
    log("authentication_failed", requestId, { reason: "invalid_token", elapsed_ms: elapsed(authStarted) });
    finish("email_notification_failed", { stage: "authentication", error_category: "unauthorized" });
    return json({ success: false, error: "Unauthorized" }, 401);
  }
  log("authentication_success", requestId, { user_id_present: true, elapsed_ms: elapsed(authStarted) });

  const payloadStarted = performance.now();
  log("payload_validation_started", requestId);
  let payload: EmailRequest;
  try { payload = await req.json(); } catch {
    log("payload_validation_failed", requestId, { reason: "invalid_json", elapsed_ms: elapsed(payloadStarted) });
    finish("email_notification_failed", { stage: "payload_validation", error_category: "invalid_json" });
    return json({ success: false, error: "Invalid JSON" }, 400);
  }
  const projectIdPresent = Boolean(payload.project_id);
  const userIdPresent = Boolean(authData.user.id);
  if (!projectIdPresent || !payload.type || !["project_confirmed", "project_status_changed"].includes(payload.type)) {
    log("payload_validation_failed", requestId, { reason: "missing_or_unsupported_fields", notification_type: payload.type ?? null, project_id_present: projectIdPresent, user_id_present: userIdPresent, elapsed_ms: elapsed(payloadStarted) });
    finish("email_notification_failed", { stage: "payload_validation", error_category: "invalid_payload" });
    return json({ success: false, error: "Unsupported notification" }, 400);
  }
  if (payload.type === "project_status_changed" && (!payload.previous_status || !payload.new_status)) {
    log("payload_validation_failed", requestId, { reason: "missing_status_transition", notification_type: payload.type, project_id_present: projectIdPresent, user_id_present: userIdPresent, elapsed_ms: elapsed(payloadStarted) });
    finish("email_notification_failed", { stage: "payload_validation", error_category: "invalid_status_transition" });
    return json({ success: false, error: "Status transition is required" }, 400);
  }
  log("payload_validation_success", requestId, { notification_type: payload.type, project_id_present: projectIdPresent, user_id_present: userIdPresent, elapsed_ms: elapsed(payloadStarted) });
  log("notification_type_resolved", requestId, { notification_type: payload.type });

  const projectLookupStarted = performance.now();
  log("project_lookup_started", requestId, { project_id: payload.project_id });
  const { data: project, error: projectError } = await caller.from("projects").select("id, project_number, title, status, currency, agreed_price, client_id").eq("id", payload.project_id).maybeSingle<ProjectRow>();
  if (projectError || !project) {
    log("project_lookup_failed", requestId, { project_id: payload.project_id, reason: projectError ? "database_error" : "not_found", elapsed_ms: elapsed(projectLookupStarted) });
    finish("email_notification_failed", { stage: "project_lookup", error_category: projectError ? "database_error" : "project_not_found" });
    return json({ success: false, error: "Project not found" }, 404);
  }
  log("project_lookup_success", requestId, { project_id: project.id, project_number: project.project_number, current_status: project.status, elapsed_ms: elapsed(projectLookupStarted) });

  log("authorization_started", requestId);
  const { data: callerProfile } = await caller.from("profiles").select("role, status").eq("id", authData.user.id).maybeSingle();
  const isOwner = project.client_id === authData.user.id;
  const isActiveAdmin = callerProfile?.role === "admin" && callerProfile?.status === "active";
  if (!isOwner && !isActiveAdmin) {
    log("authorization_failed", requestId, { authenticated_user: true, project_owner: false, active_admin: false, reason: "unauthorized_user" });
    finish("email_notification_failed", { stage: "authorization", error_category: "forbidden" });
    return json({ success: false, error: "Forbidden" }, 403);
  }
  log("authorization_success", requestId, { authenticated_user: true, project_owner: isOwner, active_admin: isActiveAdmin });

  const emailLookupStarted = performance.now();
  log("customer_email_lookup_started", requestId);
  const { data: recipient } = await caller.auth.admin.getUserById(project.client_id);
  const email = recipient.user?.email;
  if (!email) {
    log("customer_email_lookup_failed", requestId, { email_found: false, elapsed_ms: elapsed(emailLookupStarted) });
    finish("email_notification_failed", { stage: "customer_email_lookup", error_category: "recipient_email_unavailable" });
    return json({ success: false, error: "Recipient email unavailable" }, 422);
  }
  log("customer_email_lookup_success", requestId, { email_found: true, elapsed_ms: elapsed(emailLookupStarted) });

  const preferenceStarted = performance.now();
  log("preference_lookup_started", requestId);
  const { data: preference } = await caller.from("notification_preferences").select("email_project_updates").eq("user_id", project.client_id).maybeSingle();
  const emailProjectUpdates = preference?.email_project_updates !== false;
  log("preference_lookup_result", requestId, { email_project_updates: emailProjectUpdates, elapsed_ms: elapsed(preferenceStarted) });
  if (!emailProjectUpdates) {
    log("email_skipped_preference_disabled", requestId);
    finish("email_notification_skipped", { reason: "preference_disabled" });
    return json({ success: true, skipped: true, reason: "preference_disabled" });
  }

  const generationStarted = performance.now();
  log("email_generation_started", requestId);
  const siteUrl = Deno.env.get("SITE_URL") ?? "https://shakib-shahriar.vercel.app";
  const projectUrl = `${siteUrl.replace(/\/$/, "")}/profile/projects/${encodeURIComponent(project.id)}`;
  const amount = project.agreed_price == null ? null : `${escapeHtml(project.currency ?? "BDT")} ${escapeHtml(project.agreed_price)}`;
  const details = `<table style="width:100%;border-collapse:collapse;background:#f7f7f3;border-radius:8px"><tr><td style="padding:10px 12px;color:#666">Project</td><td style="padding:10px 12px;text-align:right"><strong>${escapeHtml(project.title)}</strong></td></tr><tr><td style="padding:10px 12px;color:#666">Project number</td><td style="padding:10px 12px;text-align:right">${escapeHtml(project.project_number)}</td></tr>${payload.type === "project_status_changed" ? `<tr><td style="padding:10px 12px;color:#666">Previous status</td><td style="padding:10px 12px;text-align:right">${escapeHtml(label(payload.previous_status!))}</td></tr><tr><td style="padding:10px 12px;color:#666">New status</td><td style="padding:10px 12px;text-align:right">${escapeHtml(label(payload.new_status!))}</td></tr>` : `<tr><td style="padding:10px 12px;color:#666">Status</td><td style="padding:10px 12px;text-align:right">${escapeHtml(project.status)}</td></tr>${amount ? `<tr><td style="padding:10px 12px;color:#666">Agreed amount</td><td style="padding:10px 12px;text-align:right">${amount}</td></tr>` : ""}`}</table>`;
  const confirmed = payload.type === "project_confirmed";
  const subject = confirmed ? `Project confirmed — ${project.project_number}` : `Project status updated — ${project.project_number}`;
  const html = emailLayout(confirmed ? "Project confirmed" : "Project status updated", confirmed ? "Your final quote was accepted and your project is now confirmed." : `Your project status changed from ${label(payload.previous_status!)} to ${label(payload.new_status!)}.`, details, projectUrl);
  log("email_generation_success", requestId, { notification_type: payload.type, elapsed_ms: elapsed(generationStarted) });

  const appsScriptRequestStarted = performance.now();
  const appsScriptUrlConfigured = Boolean(appsScriptUrl);
  const appsScriptSecretConfigured = Boolean(appsScriptSecret);
  log("apps_script_request_started", requestId, { apps_script_url_configured: appsScriptUrlConfigured, apps_script_secret_configured: appsScriptSecretConfigured });
  if (!appsScriptUrl || !appsScriptSecret) {
    log("apps_script_configuration_missing", requestId, { apps_script_url_configured: appsScriptUrlConfigured, apps_script_secret_configured: appsScriptSecretConfigured });
    finish("email_notification_failed", { stage: "apps_script_configuration", error_category: "configuration_missing", elapsed_ms: elapsed(appsScriptRequestStarted) });
    return json({ success: false, error: "Email delivery is not configured" }, 503);
  }

  log("apps_script_http_started", requestId);
  try {
    const response = await fetch(appsScriptUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ secret: appsScriptSecret, to: email, subject, html }) });
    const result = await response.json().catch(() => ({}));
    const success = response.ok && result.success === true;
    log("apps_script_http_response", requestId, { status: response.status, success, elapsed_ms: elapsed(appsScriptRequestStarted) });
    if (!success) {
      log("apps_script_request_failed", requestId, { status: response.status, stage: "apps_script", error_category: "delivery_rejected", elapsed_ms: elapsed(appsScriptRequestStarted) });
      finish("email_notification_failed", { stage: "apps_script", error_category: "delivery_failed" });
      return json({ success: false, error: "Email delivery failed" }, 502);
    }
    finish("email_notification_success", { notification_type: payload.type });
    return json({ success: true });
  } catch {
    log("apps_script_network_error", requestId, { stage: "apps_script", error_category: "network_or_timeout", elapsed_ms: elapsed(appsScriptRequestStarted) });
    log("apps_script_request_failed", requestId, { stage: "apps_script", error_category: "network_or_timeout", elapsed_ms: elapsed(appsScriptRequestStarted) });
    finish("email_notification_failed", { stage: "apps_script", error_category: "network_or_timeout" });
    return json({ success: false, error: "Email delivery failed" }, 502);
  }
});
