import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendMail } from "./smtp.ts";

type NotificationType =
  | "project_confirmed"
  | "project_status_changed"
  | "project_request_status_changed"
  | "project_request_received"
  | "quote_sent"
  | "quote_accepted"
  | "quote_rejected"
  | "quote_change_requested"
  | "invoice_issued"
  | "payment_received"
  | "payment_failed"
  | "payment_refunded"
  | "milestone_completed"
  | "deliverable_uploaded"
  | "project_message_received"
  | "request_message_received";

/** Who an event is addressed to. */
type Audience = "client" | "admin" | "both";

/** Per-user opt-out column on public.notification_preferences. */
type PreferenceKey =
  | "email_project_updates"
  | "email_messages"
  | "email_quotes"
  | "email_payments"
  | "email_referrals";

type Payload = {
  project_id?: string;
  request_id?: string;
  type?: NotificationType;
  previous_status?: string;
  new_status?: string;
  notification_id?: string;
  audience?: Audience;
  quote_id?: string;
  invoice_id?: string;
  payment_id?: string;
  milestone_id?: string;
  file_id?: string;
  message_id?: string;
  amount?: number | string | null;
  currency?: string | null;
  version?: number | null;
  valid_until?: string | null;
  due_date?: string | null;
  amount_due?: number | string | null;
  payment_type?: string | null;
  payment_method?: string | null;
  transaction_reference?: string | null;
  failure_reason?: string | null;
  milestone_title?: string | null;
  file_name?: string | null;
};

type Project = {
  id: string;
  request_id: string | null;
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
  backup_email: string | null;
  status: string;
  client_id: string | null;
};

/** A row of public.project_notification_recipients. */
type NotificationRecipientRow = { email: string | null };

const prefix = "[email-notification]";

/**
 * The single catalogue of every notification the studio sends.
 *
 * - `preference` maps the event onto the per-user opt-out column it respects.
 * - `audience` is the default routing. An explicit `audience` in the payload —
 *   set by the database trigger — wins, which is how thread messages pick
 *   between notifying the client and notifying the studio.
 *
 * Titles, intro copy and detail rows for each type live in buildContent(), so
 * no email markup is scattered across the function.
 */
const EVENTS: Record<
  NotificationType,
  { preference: PreferenceKey; audience: Audience }
> = {
  project_confirmed: { preference: "email_project_updates", audience: "client" },
  project_status_changed: { preference: "email_project_updates", audience: "client" },
  project_request_status_changed: { preference: "email_project_updates", audience: "client" },
  project_request_received: { preference: "email_project_updates", audience: "admin" },
  quote_sent: { preference: "email_quotes", audience: "client" },
  quote_accepted: { preference: "email_quotes", audience: "admin" },
  quote_rejected: { preference: "email_quotes", audience: "admin" },
  quote_change_requested: { preference: "email_quotes", audience: "admin" },
  invoice_issued: { preference: "email_payments", audience: "client" },
  payment_received: { preference: "email_payments", audience: "both" },
  payment_failed: { preference: "email_payments", audience: "both" },
  payment_refunded: { preference: "email_payments", audience: "client" },
  milestone_completed: { preference: "email_project_updates", audience: "client" },
  deliverable_uploaded: { preference: "email_project_updates", audience: "client" },
  project_message_received: { preference: "email_messages", audience: "client" },
  request_message_received: { preference: "email_messages", audience: "client" },
};

const SUPPORTED_TYPES = Object.keys(EVENTS) as NotificationType[];

/** Types that are meaningless without a previous/new status pair. */
const STATUS_TRANSITION_TYPES: NotificationType[] = [
  "project_status_changed",
  "project_request_status_changed",
];

/**
 * Maximum additional team/backup recipients per project or project request.
 * Mirrors public.replace_own_project_notification_recipients(), which is the
 * write path (and the enforcing gate) for customers editing this list.
 */
const MAX_TEAM_RECIPIENTS = 5;

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

/** Trim an optional email value; "" means absent. */
const normalizeEmail = (value: string | null | undefined): string =>
  (value ?? "").trim();

/** Deliberately permissive: only reject values that cannot be a usable address,
 *  so a real customer address is never dropped. */
const isUsableEmail = (value: string): boolean =>
  value.length > 0 &&
  value.length <= 254 &&
  /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value);

/** Mask an address for logs — logs must never carry a full customer address. */
const maskEmail = (value: string): string => {
  const trimmed = normalizeEmail(value);
  const at = trimmed.lastIndexOf("@");
  if (at <= 0) return "***";
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const dot = domain.lastIndexOf(".");
  const tld = dot > 0 ? domain.slice(dot) : "";
  return `${local.slice(0, 1)}***@***${tld}`;
};

/**
 * Trim, drop blank / whitespace-only / unusable values, and remove duplicates
 * case-insensitively. Order is preserved, so the primary address always wins.
 */
const dedupeEmails = (
  candidates: (string | null | undefined)[],
): string[] => {
  const list: string[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const value = normalizeEmail(candidate);
    if (!isUsableEmail(value)) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    list.push(value);
  }
  return list;
};

/**
 * Primary first, then every additional team/backup address. Blank /
 * whitespace-only / unusable values are dropped, and duplicates are removed
 * case-insensitively so the same address never results in two sends.
 */
const buildRecipients = (
  primary: string | null | undefined,
  additional: (string | null | undefined)[] = [],
): string[] => dedupeEmails([primary, ...additional]);

/**
 * The customer's optional backup address lives on the account profile
 * (public.profiles.backup_email). The copy on project_requests is only a
 * request-time snapshot, so the profile is the authoritative source for both
 * the project and project_request event paths.
 */
const loadBackupEmail = async (
  db: ReturnType<typeof createClient>,
  clientId: string | null | undefined,
): Promise<string | null> => {
  if (!clientId) return null;
  try {
    const { data } = await db
      .from("profiles")
      .select("backup_email")
      .eq("id", clientId)
      .maybeSingle<{ backup_email: string | null }>();
    return data?.backup_email ?? null;
  } catch {
    return null;
  }
};

/** Legacy snapshot kept on the request row for older clients and admin search. */
const loadRequestBackupEmail = async (
  db: ReturnType<typeof createClient>,
  requestId: string | null | undefined,
): Promise<string | null> => {
  if (!requestId) return null;
  try {
    const { data } = await db
      .from("project_requests")
      .select("backup_email")
      .eq("id", requestId)
      .maybeSingle<{ backup_email: string | null }>();
    return data?.backup_email ?? null;
  } catch {
    return null;
  }
};

/**
 * public.project_notification_recipients is the authoritative source for every
 * additional team/backup address on a project or a project request. A project
 * inherits the recipients of the request it was created from, so both scopes are
 * read for the project path.
 *
 * The legacy backup_email columns are still honoured as a fallback for records
 * that predate the table (and for older application versions). They are appended
 * last so a backup address that was already migrated into the table collapses
 * into a single delivery instead of being sent twice.
 */
const loadTeamRecipients = async (
  db: ReturnType<typeof createClient>,
  scope: { projectId?: string | null; requestId?: string | null },
  legacyFallbacks: (string | null | undefined)[] = [],
): Promise<string[]> => {
  const collected: string[] = [];

  const collect = (rows: NotificationRecipientRow[] | null) => {
    for (const row of rows ?? []) {
      const value = normalizeEmail(row?.email);
      if (value) collected.push(value);
    }
  };

  try {
    if (scope.projectId) {
      const { data } = await db
        .from("project_notification_recipients")
        .select("email")
        .eq("project_id", scope.projectId);
      collect(data as NotificationRecipientRow[] | null);
    }

    if (scope.requestId) {
      const { data } = await db
        .from("project_notification_recipients")
        .select("email")
        .eq("project_request_id", scope.requestId);
      collect(data as NotificationRecipientRow[] | null);
    }
  } catch {
    // A table-read failure must not silently drop every team recipient; fall
    // through to the legacy fallbacks below instead of throwing.
  }

  collected.push(...legacyFallbacks.map((value) => normalizeEmail(value)).filter(Boolean));

  return dedupeEmails(collected).slice(0, MAX_TEAM_RECIPIENTS);
};

/**
 * Studio-side recipients for admin-facing events: every active admin's auth
 * address plus that admin's optional profile backup address, deduplicated.
 * Uses the Auth admin API because admin_auth_emails() requires an end-user
 * admin session, which a service-to-service dispatch does not have.
 */
const loadAdminRecipients = async (
  db: ReturnType<typeof createClient>,
): Promise<{ emails: string[]; preferenceUserId: string | null }> => {
  try {
    const { data: admins } = await db
      .from("profiles")
      .select("id, backup_email")
      .eq("role", "admin")
      .eq("status", "active")
      .order("created_at");

    const rows = (admins ?? []) as { id: string; backup_email: string | null }[];
    if (rows.length === 0) return { emails: [], preferenceUserId: null };

    const collected: (string | null)[] = rows.map((r) => r.backup_email);
    for (const row of rows) {
      const { data } = await db.auth.admin.getUserById(row.id);
      collected.push(data.user?.email ?? null);
    }
    return {
      emails: dedupeEmails(collected),
      preferenceUserId: rows[0]?.id ?? null,
    };
  } catch {
    return { emails: [], preferenceUserId: null };
  }
};

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

  // Every event is scoped to a project, a request, or both: quote/invoice/
  // payment/milestone/deliverable events carry a project, while request-scoped
  // events (a submitted request, a request-thread message, a quote raised
  // before conversion) carry only the request.
  if (!isRequestType && !p.project_id && !p.request_id) {
    log("payload_validation_failed", id, {
      reason: "missing_scope",
      notification_type: type,
      elapsed_ms: ms(payloadT),
    });
    finish("email_notification_failed", {
      stage: "payload_validation",
      error_category: "invalid_payload",
    });
    return out({ success: false, error: "Project or request id is required" }, 400);
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
  let backupEmail: string | null = null;
  // Additional team/backup recipients from project_notification_recipients.
  let teamRecipientEmails: string[] = [];
  let teamRecipientScope = "not_applicable";
  let preferenceUserId: string | null = null;
  // Studio-side recipients, populated only for admin-facing events.
  let adminRecipientEmails: string[] = [];
  // Resolved from the payload/registry before recipient lookup.
  let audience: Audience = "client";
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
      .select("id, request_number, full_name, email, backup_email, status, client_id")
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
    backupEmail = await loadBackupEmail(db, request.client_id);
    preferenceUserId = request.client_id;

    // Team/backup recipients are attached to status transitions only, which is
    // the existing product behaviour. The request-scoped row set is the source
    // of truth; the legacy backup_email snapshot is a fallback.
    if (audience !== "admin") {
      const teamT = performance.now();
      teamRecipientEmails = await loadTeamRecipients(
        db,
        { requestId: request.id },
        [request.backup_email],
      );
      teamRecipientScope = "project_request_id";
      log("team_recipients_lookup_success", id, {
        scope: teamRecipientScope,
        team_recipient_count: teamRecipientEmails.length,
        team_recipients_masked: teamRecipientEmails.map(maskEmail),
        elapsed_ms: ms(teamT),
      });
    }

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
  } else if (type === "project_status_changed" || type === "project_confirmed") {
    // --------------------------------------------------- project branch
    log("project_lookup_started", id, { project_id: p.project_id });

    const result = await db
      .from("projects")
      .select("id, request_id, project_number, title, status, currency, agreed_price, client_id")
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
    backupEmail = await loadBackupEmail(db, project.client_id);
    preferenceUserId = project.client_id;

    // A project inherits the recipients of the request it was created from, and
    // can additionally own its own rows, so both scopes are read here.
    if (audience !== "admin") {
      const teamT = performance.now();
      const legacyRequestBackup = await loadRequestBackupEmail(
        db,
        project.request_id,
      );
      teamRecipientEmails = await loadTeamRecipients(
        db,
        { projectId: project.id, requestId: project.request_id },
        [legacyRequestBackup],
      );
      teamRecipientScope = "project_id+project_request_id";
      log("team_recipients_lookup_success", id, {
        scope: teamRecipientScope,
        has_linked_request: Boolean(project.request_id),
        team_recipient_count: teamRecipientEmails.length,
        team_recipients_masked: teamRecipientEmails.map(maskEmail),
        elapsed_ms: ms(teamT),
      });
    }

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
  } else {
    // ------------------------------------- generic workflow event branch
    // Single code path for quote / invoice / payment / milestone / deliverable
    // / message / request-received events. Titles, copy and CTAs live in the
    // switch below so email markup is not scattered across the codebase.
    const evt = EVENTS[type];
    audience = p.audience ?? evt.audience;

    let clientId: string | null = null;
    let projectId: string | null = p.project_id ?? null;
    let requestId: string | null = p.request_id ?? null;
    let projectNumber: string | null = null;
    let projectTitle: string | null = null;
    let requestNumber: string | null = null;
    let requestName: string | null = null;
    let requestEmail: string | null = null;
    let requestBackup: string | null = null;

    if (requestId) {
      const { data } = await db
        .from("project_requests")
        .select("id, request_number, full_name, email, backup_email, client_id")
        .eq("id", requestId)
        .maybeSingle<ProjectRequest>();
      if (data) {
        clientId = data.client_id;
        requestNumber = data.request_number;
        requestName = data.full_name;
        requestEmail = data.email;
        requestBackup = data.backup_email;
      }
    }

    if (projectId) {
      const { data } = await db
        .from("projects")
        .select(
          "id, request_id, project_number, title, status, currency, agreed_price, client_id",
        )
        .eq("id", projectId)
        .maybeSingle<Project>();
      if (data) {
        clientId = clientId ?? data.client_id;
        projectNumber = data.project_number;
        projectTitle = data.title;
        requestId = requestId ?? data.request_id;
      }
    }

    log("event_context_resolved", id, {
      audience,
      client_linked: Boolean(clientId),
      project_scope: Boolean(projectId),
      request_scope: Boolean(requestId),
    });

    // ---------------------------------------------------- client recipients
    if (audience !== "admin") {
      if (clientId) preferenceUserId = clientId;

      const fromRequest = normalizeEmail(requestEmail);
      if (isUsableEmail(fromRequest)) {
        recipientEmail = fromRequest;
      } else if (clientId) {
        const r = await db.auth.admin.getUserById(clientId);
        recipientEmail = r.data.user?.email?.trim() ?? null;
      }

      if (clientId) {
        backupEmail = await loadBackupEmail(db, clientId);
      }

      const teamT = performance.now();
      teamRecipientEmails = await loadTeamRecipients(
        db,
        { projectId, requestId },
        [requestBackup],
      );
      teamRecipientScope = projectId && requestId
        ? "project_id+project_request_id"
        : projectId
          ? "project_id"
          : requestId
            ? "project_request_id"
            : "not_applicable";
      log("team_recipients_lookup_success", id, {
        scope: teamRecipientScope,
        team_recipient_count: teamRecipientEmails.length,
        team_recipients_masked: teamRecipientEmails.map(maskEmail),
        elapsed_ms: ms(teamT),
      });
    }

    // ----------------------------------------------------- admin recipients
    if (audience !== "client") {
      const adminT = performance.now();
      const admins = await loadAdminRecipients(db);
      adminRecipientEmails = admins.emails;
      if (audience === "admin" && preferenceUserId === null) {
        preferenceUserId = admins.preferenceUserId;
      }
      log("admin_recipients_lookup_success", id, {
        admin_recipient_count: adminRecipientEmails.length,
        admin_recipients_masked: adminRecipientEmails.map(maskEmail),
        elapsed_ms: ms(adminT),
      });
      if (audience === "admin" && adminRecipientEmails.length === 0) {
        log("email_skipped_no_admin_recipients", id);
        finish("email_notification_skipped", { reason: "no_admin_recipients" });
        return out({ success: true, skipped: true, reason: "no_admin_recipients" });
      }
    }

    // ------------------------------------------------------------- content
    const clientUrl = projectId
      ? `${baseSite}/profile/projects/${encodeURIComponent(projectId)}`
      : `${baseSite}/profile/project-requests/${encodeURIComponent(requestId ?? "")}`;
    const adminUrl = requestId
      ? `${baseSite}/admin/project-requests/${encodeURIComponent(requestId)}`
      : `${baseSite}/admin/projects/${encodeURIComponent(projectId ?? "")}`;

    // Plain-text money for intro copy; escaped at the point of HTML insertion.
    const money = (v: unknown, c: unknown) =>
      v == null || v === "" ? "—" : `${c ?? "BDT"} ${v}`;
    const scopeName = projectTitle ?? requestName ?? "your project";
    const scopeNumber = projectNumber ?? requestNumber ?? "";
    const rows: string[] = [];

    let heading = "Notification";
    let intro = "There is an update on your account.";
    let url = audience === "admin" ? adminUrl : clientUrl;
    let linkLabel = audience === "admin" ? "Open in admin" : "Open dashboard";

    switch (type) {
      case "project_request_received":
        heading = "New project request";
        intro = `A new project request ${scopeNumber} was submitted.`;
        rows.push(`<tr><td>Request</td><td>${esc(scopeNumber || "—")}</td></tr>`);
        rows.push(`<tr><td>From</td><td>${esc(requestName ?? "—")}</td></tr>`);
        url = `${baseSite}/admin/project-requests/${encodeURIComponent(requestId ?? "")}`;
        linkLabel = "Open request";
        break;

      case "quote_sent":
        heading = "Your quote is ready";
        intro = `A quote for ${scopeName} is ready for your review.`;
        rows.push(`<tr><td>Project</td><td>${esc(scopeName)}</td></tr>`);
        rows.push(`<tr><td>Quote version</td><td>${esc(p.version ?? 1)}</td></tr>`);
        rows.push(`<tr><td>Total</td><td>${esc(money(p.amount, p.currency))}</td></tr>`);
        if (p.valid_until) {
          rows.push(
            `<tr><td>Valid until</td><td>${esc(String(p.valid_until).slice(0, 10))}</td></tr>`,
          );
        }
        break;

      case "quote_accepted":
      case "quote_rejected":
      case "quote_change_requested":
        heading = type === "quote_accepted"
          ? "Quote accepted"
          : type === "quote_rejected"
            ? "Quote rejected"
            : "Quote change requested";
        intro = type === "quote_accepted"
          ? `The client accepted the quote for ${scopeName}.`
          : type === "quote_rejected"
            ? `The client rejected the quote for ${scopeName}.`
            : `The client requested changes to the quote for ${scopeName}.`;
        rows.push(`<tr><td>Project</td><td>${esc(scopeName)}</td></tr>`);
        rows.push(`<tr><td>Quote version</td><td>${esc(p.version ?? 1)}</td></tr>`);
        rows.push(`<tr><td>Total</td><td>${esc(money(p.amount, p.currency))}</td></tr>`);
        url = `${baseSite}/admin/quotes/${encodeURIComponent(p.quote_id ?? "")}`;
        linkLabel = "Open quote";
        break;

      case "invoice_issued":
        heading = "Invoice issued";
        intro = `An invoice has been issued for ${scopeName}.`;
        rows.push(`<tr><td>Project</td><td>${esc(scopeName)}</td></tr>`);
        rows.push(`<tr><td>Amount due</td><td>${esc(money(p.amount_due, p.currency))}</td></tr>`);
        if (p.due_date) {
          rows.push(
            `<tr><td>Due date</td><td>${esc(String(p.due_date).slice(0, 10))}</td></tr>`,
          );
        }
        break;

      case "payment_received":
      case "payment_failed":
      case "payment_refunded":
        heading = type === "payment_received"
          ? "Payment received"
          : type === "payment_failed"
            ? "Payment failed"
            : "Payment refunded";
        intro = type === "payment_received"
          ? `A payment of ${money(p.amount, p.currency)} was received.`
          : type === "payment_failed"
            ? `A payment of ${money(p.amount, p.currency)} did not go through.`
            : `A refund of ${money(p.amount, p.currency)} was issued.`;
        rows.push(`<tr><td>Project</td><td>${esc(scopeName)}</td></tr>`);
        rows.push(`<tr><td>Amount</td><td>${esc(money(p.amount, p.currency))}</td></tr>`);
        if (p.payment_type) {
          rows.push(`<tr><td>Type</td><td>${esc(p.payment_type)}</td></tr>`);
        }
        if (p.payment_method) {
          rows.push(`<tr><td>Method</td><td>${esc(p.payment_method)}</td></tr>`);
        }
        if (p.transaction_reference) {
          rows.push(`<tr><td>Reference</td><td>${esc(p.transaction_reference)}</td></tr>`);
        }
        if (p.failure_reason) {
          rows.push(`<tr><td>Reason</td><td>${esc(p.failure_reason)}</td></tr>`);
        }
        if (audience !== "client") {
          url = `${baseSite}/admin/payments`;
          linkLabel = "Open payments";
        }
        break;

      case "milestone_completed":
        heading = "Milestone completed";
        intro = `The milestone "${p.milestone_title ?? "milestone"}" is complete.`;
        rows.push(`<tr><td>Project</td><td>${esc(scopeName)}</td></tr>`);
        rows.push(`<tr><td>Milestone</td><td>${esc(p.milestone_title ?? "—")}</td></tr>`);
        break;

      case "deliverable_uploaded":
        heading = "New deliverable available";
        intro = `A new deliverable is available for ${scopeName}.`;
        rows.push(`<tr><td>Project</td><td>${esc(scopeName)}</td></tr>`);
        rows.push(`<tr><td>File</td><td>${esc(p.file_name ?? "—")}</td></tr>`);
        break;

      case "project_message_received":
      case "request_message_received":
        heading = "New message";
        intro = audience === "admin"
          ? "A client posted a new message."
          : "You have a new message from the studio.";
        rows.push(`<tr><td>Thread</td><td>${esc(scopeName)}</td></tr>`);
        if (audience === "admin") {
          url = requestId
            ? `${baseSite}/admin/project-requests/${encodeURIComponent(requestId)}/messages`
            : `${baseSite}/admin/projects/${encodeURIComponent(projectId ?? "")}/messages`;
          linkLabel = "Open thread";
        } else {
          url = requestId
            ? `${baseSite}/profile/project-requests/${encodeURIComponent(requestId)}/messages`
            : `${baseSite}/profile/projects/${encodeURIComponent(projectId ?? "")}/messages`;
          linkLabel = "Open thread";
        }
        break;
    }

    subject = scopeNumber ? `${heading} — ${scopeNumber}` : heading;
    const details =
      `<table><tr><td>Reference</td><td>${esc(scopeNumber || "—")}</td></tr>` +
      `${rows.join("")}</table>`;
    html = layout(heading, intro, details, url, linkLabel);
  }

  const genT = performance.now();
  log("email_generation_started", id);
  log("email_generation_success", id, {
    notification_type: type,
    elapsed_ms: ms(genT),
  });

  // ----------------------------------------------------- preference gate
  // Each event honours its own opt-out column on notification_preferences
  // instead of every event sharing email_project_updates.
  const preferenceKey: PreferenceKey = EVENTS[type].preference;
  const prefT = performance.now();
  log("preference_lookup_started", id, { preference_key: preferenceKey });
  const pref = preferenceUserId
    ? await db
        .from("notification_preferences")
        .select(preferenceKey)
        .eq("user_id", preferenceUserId)
        .maybeSingle()
    : { data: null };
  const enabled =
    (pref.data as Record<string, boolean> | null)?.[preferenceKey] !== false;
  log("preference_lookup_result", id, {
    preference_key: preferenceKey,
    enabled,
    elapsed_ms: ms(prefT),
  });
  if (!enabled) {
    log("email_skipped_preference_disabled", id, {
      preference_key: preferenceKey,
    });
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

  // -------------------------------------- recipients (normalised, deduplicated)
  // The primary customer address plus every additional team/backup recipient
  // configured for the project or project request. Whitespace is trimmed,
  // comparison is case-insensitive, and each unique address is delivered once.
  // Every candidate address from every source, before deduplication. Used only
  // to report how many duplicates were collapsed.
  const candidates = [
    recipientEmail,
    ...teamRecipientEmails,
    backupEmail,
    ...adminRecipientEmails,
  ].filter((value) => isUsableEmail(normalizeEmail(value)));

  const recipients = buildRecipients(recipientEmail, [
    ...teamRecipientEmails,
    backupEmail,
    ...adminRecipientEmails,
  ]);
  const primaryNormalized = normalizeEmail(recipientEmail);
  const backupNormalized = normalizeEmail(backupEmail);
  const primaryKey = primaryNormalized.toLowerCase();
  log("recipient_resolution", id, {
    primary_present: isUsableEmail(primaryNormalized),
    primary_masked: isUsableEmail(primaryNormalized)
      ? maskEmail(primaryNormalized)
      : null,
    team_recipient_scope: teamRecipientScope,
    team_recipients_configured: teamRecipientEmails.length,
    team_recipients_masked: teamRecipientEmails.map(maskEmail),
    backup_source: "profiles.backup_email",
    backup_present: Boolean(backupNormalized),
    backup_usable: isUsableEmail(backupNormalized),
    backup_masked: isUsableEmail(backupNormalized)
      ? maskEmail(backupNormalized)
      : null,
    backup_same_as_primary:
      isUsableEmail(backupNormalized) &&
      isUsableEmail(primaryNormalized) &&
      primaryNormalized.toLowerCase() === backupNormalized.toLowerCase(),
    // Addresses dropped because they duplicate the primary or another
    // additional recipient — proves no address is delivered twice.
    audience,
    admin_recipient_count: adminRecipientEmails.length,
    admin_recipients_masked: adminRecipientEmails.map(maskEmail),
    deduplicated_addresses: candidates.length - recipients.length,
    unique_recipients: recipients.length,
    recipients_masked: recipients.map(maskEmail),
  });

  log("recipient_list_finalised", id, {
    recipients_total: recipients.length,
    // Only the primary keeps the customer address; everything else is a team
    // recipient. Reported masked so logs never carry a full address.
    primary_masked: isUsableEmail(primaryNormalized)
      ? maskEmail(primaryNormalized)
      : null,
    additional_masked: recipients
      .filter((value) => value.toLowerCase() !== primaryKey)
      .map(maskEmail),
  });

  if (recipients.length === 0) {
    finish("email_notification_failed", {
      stage: "recipient_resolution",
      error_category: "recipient_email_unavailable",
    });
    return out({ success: false, error: "Recipient email unavailable" }, 422);
  }

  // ------------------------------------------------------ delivery
  // Each recipient is sent to independently and tracked individually, so a
  // recipient that already succeeded is never re-sent on retry.
  const smtpT = performance.now();
  const maxSmtpAttempts = 2;
  const delivered: string[] = [];
  const failures: { recipient: string; stage: string; status: number | null }[] =
    [];

  for (const recipient of recipients) {
    let sent = false;

    for (let attempt = 1; attempt <= maxSmtpAttempts; attempt++) {
      log("smtp_send_started", id, {
        attempt,
        max_attempts: maxSmtpAttempts,
        port: smtpPort,
        implicit_tls: smtpPort === 465,
        recipient: maskEmail(recipient),
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
          to: recipient,
          replyTo: smtpFrom,
          subject,
          html,
          text: htmlToText(html),
        },
      );

      if (result.ok) {
        sent = true;
        log("smtp_send_success", id, {
          attempt,
          recipient: maskEmail(recipient),
          elapsed_ms: ms(smtpT),
        });
        break;
      }

      log("smtp_send_failed", id, {
        attempt,
        recipient: maskEmail(recipient),
        stage: result.stage,
        status: result.status ?? null,
        retryable: result.retryable,
        server_message: result.message,
        elapsed_ms: ms(smtpT),
      });

      if (!result.retryable || attempt === maxSmtpAttempts) {
        failures.push({
          recipient,
          stage: result.stage,
          status: result.status ?? null,
        });
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    if (sent) delivered.push(recipient);
  }

  if (failures.length === 0) {
    log("email_delivery_summary", id, {
      outcome: "all_delivered",
      recipients_total: recipients.length,
      recipients_delivered: delivered.length,
      elapsed_ms: ms(smtpT),
    });
    finish("email_notification_success", {
      notification_type: type,
      transport: "gmail_smtp",
      recipients_total: recipients.length,
      recipients_delivered: delivered.length,
    });
    return out({
      success: true,
      transport: "gmail_smtp",
      recipients: recipients.length,
      delivered: delivered.length,
    });
  }

  // A required recipient failed: never report complete success, and make the
  // partial outcome observable without exposing addresses.
  log("email_delivery_summary", id, {
    outcome: delivered.length > 0 ? "partial_failure" : "total_failure",
    recipients_total: recipients.length,
    recipients_delivered: delivered.length,
    recipients_failed: failures.length,
    failed_masked: failures.map((failure) => maskEmail(failure.recipient)),
    failed_stages: failures.map((failure) => failure.stage),
    failed_statuses: failures.map((failure) => failure.status),
    elapsed_ms: ms(smtpT),
  });
  finish("email_notification_failed", {
    stage: "smtp_delivery",
    error_category:
      delivered.length > 0 ? "partial_delivery_failure" : "delivery_failed",
    transport: "gmail_smtp",
    recipients_total: recipients.length,
    recipients_delivered: delivered.length,
  });
  return out(
    {
      success: false,
      transport: "gmail_smtp",
      recipients: recipients.length,
      delivered: delivered.length,
      failed: failures.length,
      error:
        delivered.length > 0
          ? "Partial email delivery failure"
          : "Email delivery failed",
    },
    502,
  );
});
