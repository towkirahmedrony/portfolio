import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  CLIENT_DETAIL_COLUMNS,
  emptyClientDetails,
  type ClientDetails,
} from "@/lib/admin-client-details";
import type { ProfileRow } from "@/types/database";

export { toProjectClient } from "@/lib/admin-client-details";

/**
 * Resolve the trusted account email(s) for the given profile ids out of
 * auth.users.
 *
 * Uses the existing admin-gated `admin_auth_emails(uuid[])` SECURITY DEFINER
 * RPC introduced by 20260904140000_admin_clients.sql. That function raises for
 * any caller that is not an active admin, is revoked from `anon`, and keeps
 * the `auth` schema entirely server-side. The service-role key is never used
 * here and never reaches the browser — the caller's own admin session cookie
 * client is what runs the RPC, so RLS/auth expectations are unchanged.
 */
export async function fetchAdminAuthEmails(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  ids: string[],
): Promise<{ emails: Map<string, string>; available: boolean }> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) {
    return { emails: new Map(), available: true };
  }

  const { data, error } = await supabase.rpc("admin_auth_emails", {
    p_ids: unique,
  });

  if (error) {
    return { emails: new Map(), available: false };
  }

  const emails = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.email) {
      emails.set(row.profile_id, row.email);
    }
  }

  return { emails, available: true };
}

/**
 * Load the full admin-visible client details for one profile id.
 *
 * Callers must already be behind `requireAdmin()`. Two independent reads run
 * concurrently rather than in series — the `profiles` row (RLS lets active
 * admins read every profile) and the trusted-email RPC — which keeps the page
 * at the same query latency as the single profile query this replaces.
 *
 * Never throws: a missing profile, a null/absent client id (anonymous
 * submission) or a failed email lookup is reported through `hasAccount` /
 * `emailAvailable` so both detail pages keep rendering.
 */
export async function getAdminClientDetails(
  profileId: string | null | undefined,
): Promise<ClientDetails> {
  const id = profileId?.trim() || null;
  if (!id) {
    return emptyClientDetails(null);
  }

  const supabase = await createServerSupabaseClient();

  const [profileResult, authEmails] = await Promise.all([
    supabase
      .from("profiles")
      .select(CLIENT_DETAIL_COLUMNS)
      .eq("id", id)
      .maybeSingle(),
    fetchAdminAuthEmails(supabase, [id]),
  ]);

  const profile = (profileResult.data as ProfileRow | null) ?? null;

  if (profileResult.error || !profile) {
    return emptyClientDetails(id, authEmails.available);
  }

  return {
    profileId: profile.id,
    hasAccount: true,
    fullName: profile.full_name ?? null,
    displayName: profile.display_name,
    email: authEmails.emails.get(profile.id) ?? null,
    emailAvailable: authEmails.available,
    emailVerified: profile.email_verified,
    phone: profile.phone,
    companyName: profile.company_name,
    jobTitle: profile.job_title,
    avatarUrl: profile.avatar_url,
    role: profile.role,
    status: profile.status,
    accountCreatedAt: profile.created_at,
    profileUpdatedAt: profile.updated_at,
    lastSeenAt: profile.last_seen_at,
  };
}
