import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type EmailRequest = {
  notification_id?: string;
  project_id?: string;
  type?: string;
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

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const emailLayout = (title: string, intro: string, body: string, actionUrl: string | null) => `<!doctype html>
<html><body style="margin:0;background:#f5f4ef;color:#20211f;font-family:Arial,sans-serif;line-height:1.55">
  <div style="max-width:620px;margin:32px auto;padding:0 16px">
    <div style="background:#173f35;color:#fff;padding:22px 28px;border-radius:14px 14px 0 0"><strong>Shakib Shahriar</strong><div style="font-size:12px;opacity:.78;margin-top:4px">Freelance Web Developer</div></div>
    <div style="background:#fff;padding:30px 28px;border:1px solid #e3e1d9;border-top:0;border-radius:0 0 14px 14px">
      <h1 style="font-size:24px;margin:0 0 12px">${escapeHtml(title)}</h1>
      <p style="margin:0 0 22px">${escapeHtml(intro)}</p>
      ${body}
      ${actionUrl ? `<p style="margin:26px 0 4px"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#173f35;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px">Open project</a></p>` : ""}
      <p style="font-size:12px;color:#777;margin:30px 0 0">This is a transactional notification about your project. Please reply to the original conversation if you need help.</p>
    </div>
  </div>
</body></html>`;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const appsScriptUrl = Deno.env.get("GOOGLE_APPS_SCRIPT_URL");
  const appsScriptSecret = Deno.env.get("GOOGLE_APPS_SCRIPT_SECRET");
  if (!supabaseUrl || !serviceRoleKey) return json({ success: false, error: "Server configuration incomplete" }, 500);

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) return json({ success: false, error: "Unauthorized" }, 401);
  const caller = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const token = authHeader.slice(7);
  const { data: authData, error: authError } = await caller.auth.getUser(token);
  if (authError || !authData.user) return json({ success: false, error: "Unauthorized" }, 401);

  let payload: EmailRequest;
  try { payload = await req.json(); } catch { return json({ success: false, error: "Invalid JSON" }, 400); }
  if (payload.type !== "project_confirmed" || !payload.project_id) return json({ success: false, error: "Unsupported notification" }, 400);

  const { data: project, error: projectError } = await caller
    .from("projects")
    .select("id, project_number, title, status, currency, agreed_price, client_id")
    .eq("id", payload.project_id)
    .maybeSingle<ProjectRow>();
  if (projectError || !project || project.client_id !== authData.user.id) return json({ success: false, error: "Project not found" }, 404);

  const { data: preference } = await caller
    .from("notification_preferences")
    .select("email_project_updates")
    .eq("user_id", project.client_id)
    .maybeSingle();
  if (preference?.email_project_updates === false) return json({ success: true, skipped: true, reason: "preference_disabled" });

  const { data: recipient } = await caller.auth.admin.getUserById(project.client_id);
  const email = recipient.user?.email;
  if (!email) return json({ success: false, error: "Recipient email unavailable" }, 422);
  if (!appsScriptUrl || !appsScriptSecret) return json({ success: false, error: "Email delivery is not configured" }, 503);

  const siteUrl = Deno.env.get("SITE_URL") ?? "https://shakib-shahriar.vercel.app";
  const projectUrl = `${siteUrl.replace(/\/$/, "")}/profile/projects/${encodeURIComponent(project.id)}`;
  const amount = project.agreed_price === null || project.agreed_price === undefined
    ? null
    : `${escapeHtml(project.currency ?? "BDT")} ${escapeHtml(project.agreed_price)}`;
  const details = `<table style="width:100%;border-collapse:collapse;background:#f7f7f3;border-radius:8px"><tr><td style="padding:10px 12px;color:#666">Project</td><td style="padding:10px 12px;text-align:right"><strong>${escapeHtml(project.title)}</strong></td></tr><tr><td style="padding:10px 12px;color:#666">Project number</td><td style="padding:10px 12px;text-align:right">${escapeHtml(project.project_number)}</td></tr><tr><td style="padding:10px 12px;color:#666">Status</td><td style="padding:10px 12px;text-align:right">${escapeHtml(project.status)}</td></tr>${amount ? `<tr><td style="padding:10px 12px;color:#666">Agreed amount</td><td style="padding:10px 12px;text-align:right">${amount}</td></tr>` : ""}</table>`;
  const html = emailLayout("Project confirmed", "Your final quote was accepted and your project is now confirmed.", details, projectUrl);

  try {
    const response = await fetch(appsScriptUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret: appsScriptSecret, to: email, subject: `Project confirmed — ${project.project_number}`, html }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success !== true) {
      console.error("Transactional email delivery failed", { status: response.status, projectId: project.id });
      return json({ success: false, error: "Email delivery failed" }, 502);
    }
    return json({ success: true });
  } catch (error) {
    console.error("Transactional email request failed", { projectId: project.id, message: error instanceof Error ? error.message : "unknown" });
    return json({ success: false, error: "Email delivery failed" }, 502);
  }
});
