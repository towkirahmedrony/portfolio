import type { ProfileRole, ProfileStatus } from "@/types/database";

/**
 * Shared, client-safe description of the admin-visible client record.
 *
 * This module is intentionally free of server imports (mirroring the existing
 * `admin-client-constants.ts` / `admin-clients.ts` split) so both the server
 * data layer and the presentational card can share one shape without pulling
 * `next/headers` into a client bundle. The server fetchers live in
 * `admin-client-details-server.ts`.
 *
 * Data sources in the live production schema:
 *
 *   profiles   -> full name, display name, avatar, phone, company, job title,
 *                 role, status, email_verified, created_at, updated_at,
 *                 last_seen_at
 *   auth.users -> the trusted account email, read server-side through the
 *                 admin-gated `admin_auth_emails` RPC
 *
 * The email is deliberately NOT copied into `profiles` (schema rule: never
 * duplicate auth.users), so it is resolved through that secure relationship
 * instead of being stored twice.
 */

/**
 * Admin-visible `profiles` columns.
 *
 * Every column here is either explicitly intended for admin use or is account
 * metadata the admin dashboard already renders on /admin/clients. `profiles`
 * stores no credential of any kind — passwords, hashes, access/refresh tokens
 * and sessions live in the `auth` schema and are never selected on this path.
 */
export const CLIENT_DETAIL_COLUMNS =
  "id, full_name, display_name, avatar_url, phone, company_name, job_title, role, status, email_verified, created_at, updated_at, last_seen_at";

/**
 * Optional fields are nullable by design: a client profile can exist while its
 * optional columns are NULL in production, and the UI must degrade gracefully
 * rather than break.
 */
export type ClientDetails = {
  /** profiles.id, which is also auth.users.id (1:1). Null when nothing is linked. */
  profileId: string | null;
  /** True only when a `profiles` row was actually found. */
  hasAccount: boolean;
  fullName: string | null;
  displayName: string | null;
  /** Trusted email from auth.users. Null when there is no account or no email. */
  email: string | null;
  /**
   * False when the trusted-email lookup could not run (for example the
   * admin-gated RPC is unavailable in this schema). Lets the UI say
   * "not available" instead of implying the client has no email.
   */
  emailAvailable: boolean;
  emailVerified: boolean | null;
  phone: string | null;
  companyName: string | null;
  jobTitle: string | null;
  avatarUrl: string | null;
  role: ProfileRole | null;
  status: ProfileStatus | null;
  accountCreatedAt: string | null;
  profileUpdatedAt: string | null;
  lastSeenAt: string | null;
};

/**
 * The shape of the compact profile summary the rest of the admin dashboard
 * already consumes (`ProjectClient`). Declared structurally so this module
 * never has to import the constants barrel that imports `ClientDetails`.
 */
export type ProjectClientLike = {
  id: string;
  full_name: string;
  display_name: string | null;
  company_name: string | null;
  avatar_url: string | null;
};

export function emptyClientDetails(
  profileId: string | null = null,
  emailAvailable = true,
): ClientDetails {
  return {
    profileId,
    hasAccount: false,
    fullName: null,
    displayName: null,
    email: null,
    emailAvailable,
    emailVerified: null,
    phone: null,
    companyName: null,
    jobTitle: null,
    avatarUrl: null,
    role: null,
    status: null,
    accountCreatedAt: null,
    profileUpdatedAt: null,
    lastSeenAt: null,
  };
}

/**
 * Collapse `ClientDetails` back into the compact profile summary shape that
 * existing admin components (project lists, quote panels, messages, history)
 * already expect. Returns null when no profile row exists, which is what those
 * call sites already treat as "Unknown client".
 */
export function toProjectClient(details: ClientDetails): ProjectClientLike | null {
  if (!details.hasAccount || !details.profileId) {
    return null;
  }

  return {
    id: details.profileId,
    full_name: details.fullName ?? "",
    display_name: details.displayName,
    company_name: details.companyName,
    avatar_url: details.avatarUrl,
  };
}

/** Prominent display name: display name first, then full name. */
export function clientDetailsName(details: ClientDetails): string | null {
  const display = details.displayName?.trim();
  if (display) {
    return display;
  }

  const full = details.fullName?.trim();
  return full ? full : null;
}

/** Uppercase initials for the avatar fallback. */
export function clientInitials(details: ClientDetails): string {
  const name = clientDetailsName(details);
  if (!name) {
    return "?";
  }

  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  const initials = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return initials || "?";
}
