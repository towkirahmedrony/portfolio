import type { ReactNode } from "react";
import Link from "next/link";
import { CopyButton } from "@/components/admin/clients/copy-button";
import { AdminPanel, StatusPill } from "@/components/admin/projects/query-state";
import {
  EMAIL_VERIFIED_STYLES,
  formatClientStatusLabel,
  formatDate,
  formatDateTime,
  getClientStatusStyle,
} from "@/lib/admin-client-constants";
import {
  clientDetailsName,
  clientInitials,
  type ClientDetails,
} from "@/lib/admin-client-details";

/**
 * Contact values as captured on the submitted request form.
 *
 * These are request-scoped form inputs, NOT the client's account record: in
 * production the same linked client account can carry several different
 * submitted names/emails (the anonymous `/start-project` form lets anyone type
 * anything). They are surfaced separately from the account record so an admin
 * can spot a mismatch without mistaking the form value for the trusted one.
 */
export type SubmittedContact = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
};

function Value({ children }: { children: ReactNode }) {
  return <dd className="text-foreground">{children}</dd>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <Value>{children}</Value>
    </div>
  );
}

/** Empty optional fields render a neutral dash instead of breaking. */
function orDash(value: string | null | undefined): ReactNode {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

function normalise(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * True when a submitted form value differs from the linked account value, so
 * the "submitted" block is only shown when it actually adds information.
 */
function differs(submitted: string | null | undefined, account: string | null | undefined): boolean {
  const left = normalise(submitted);
  const right = normalise(account);
  return Boolean(left) && left !== right;
}

function hasSubmittedContact(submitted: SubmittedContact | null | undefined): boolean {
  if (!submitted) {
    return false;
  }

  return Boolean(
    submitted.name?.trim() ||
      submitted.email?.trim() ||
      submitted.phone?.trim() ||
      submitted.company?.trim(),
  );
}

/**
 * Dedicated Client Details section shared by the admin Project Request detail
 * page and the admin Project detail page.
 *
 * The two pages reach the client through different relationships
 * (`project_requests.client_id` vs `projects.client_id`), but both resolve to
 * the same `profiles` row plus the auth.users email, so they share this one
 * presentational card. It is a server component: it receives already-fetched,
 * already-authorised data and never queries or fetches anything in the browser.
 *
 * Only non-sensitive fields are rendered — no password, hash, token, session
 * or other authentication secret is passed in or displayed.
 */
export function ClientDetailsCard({
  details,
  submitted,
  title = "Client details",
  description,
  actions,
}: {
  details: ClientDetails;
  submitted?: SubmittedContact | null;
  title?: string;
  description?: string;
  actions?: ReactNode;
}) {
  const name = clientDetailsName(details);
  const email = details.email?.trim() || null;
  const phone = details.phone?.trim() || null;
  const submittedBlock =
    hasSubmittedContact(submitted) &&
    (!details.hasAccount ||
      differs(submitted?.name, details.fullName) ||
      differs(submitted?.name, details.displayName) ||
      differs(submitted?.email, email) ||
      differs(submitted?.phone, phone) ||
      differs(submitted?.company, details.companyName));

  return (
    <AdminPanel
      title={title}
      description={
        description ??
        "Client account record: profiles (1:1 with auth.users) plus the trusted account email read server-side from auth.users."
      }
    >
      {details.hasAccount ? (
        <>
          <div className="flex flex-wrap items-start gap-4">
            {details.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- Google/Supabase avatars are arbitrary https hosts; admin UI renders them unoptimized by convention.
              <img
                src={details.avatarUrl}
                alt=""
                className="h-14 w-14 shrink-0 rounded-full border border-card-border object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-card-border bg-background text-sm font-medium text-muted"
              >
                {clientInitials(details)}
              </span>
            )}

            <div className="min-w-0 flex-1">
              <p className="font-display text-xl tracking-tight text-foreground">
                {name ?? "Unnamed client"}
              </p>

              {email ? (
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                  <a href={`mailto:${email}`} className="break-all text-foreground underline">
                    {email}
                  </a>
                  <CopyButton value={email} label="email" />
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted">
                  {details.emailAvailable
                    ? "No account email on record."
                    : "Account email not available."}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {details.status ? (
                  <StatusPill
                    label={formatClientStatusLabel(details.status)}
                    className={getClientStatusStyle(details.status)}
                  />
                ) : null}
                {details.emailVerified != null ? (
                  <StatusPill
                    label={details.emailVerified ? "Email verified" : "Email unverified"}
                    className={
                      details.emailVerified
                        ? EMAIL_VERIFIED_STYLES.verified
                        : EMAIL_VERIFIED_STYLES.unverified
                    }
                  />
                ) : null}
                {details.role ? (
                  <StatusPill
                    label={details.role === "admin" ? "Admin account" : "Client account"}
                    className="border-card-border bg-background text-muted"
                  />
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-3">
              {actions}
              {details.profileId ? (
                <Link
                  href={`/admin/clients/${details.profileId}`}
                  className="text-sm font-medium text-accent hover:underline"
                >
                  Open client record &rarr;
                </Link>
              ) : null}
            </div>
          </div>

          <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Full name">{orDash(details.fullName)}</Field>
            <Field label="Display name">{orDash(details.displayName)}</Field>
            <div>
              <dt className="text-muted">Phone</dt>
              <Value>
                {phone ? (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <a href={`tel:${phone}`} className="break-all text-foreground underline">
                      {phone}
                    </a>
                    <CopyButton value={phone} label="phone" />
                  </span>
                ) : (
                  "—"
                )}
              </Value>
            </div>
            <Field label="Company">{orDash(details.companyName)}</Field>
            <Field label="Job title">{orDash(details.jobTitle)}</Field>
            <Field label="Client ID">
              <span className="inline-flex flex-wrap items-center gap-2">
                <span className="break-all font-mono text-xs">{details.profileId}</span>
                {details.profileId ? (
                  <CopyButton value={details.profileId} label="client ID" />
                ) : null}
              </span>
            </Field>
            <Field label="Member since">{formatDate(details.accountCreatedAt)}</Field>
            <Field label="Last active">{formatDateTime(details.lastSeenAt)}</Field>
            <Field label="Profile updated">{formatDateTime(details.profileUpdatedAt)}</Field>
          </dl>
        </>
      ) : (
        <p className="text-sm text-muted">
          {details.profileId
            ? "No client profile could be loaded for this account."
            : "No client account is linked to this record."}
        </p>
      )}

      {submittedBlock ? (
        <div className="mt-6 rounded-2xl border border-dashed border-card-border p-4">
          <p className="text-sm font-medium text-foreground">
            Contact details submitted with this request
          </p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Captured on the request form. The form is open to anonymous
            submissions, so these values are not verified and may differ from
            the account record above.
          </p>
          <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
            <Field label="Name">{orDash(submitted?.name)}</Field>
            <Field label="Email">{orDash(submitted?.email)}</Field>
            <Field label="Phone">{orDash(submitted?.phone)}</Field>
            <Field label="Company">{orDash(submitted?.company)}</Field>
          </dl>
        </div>
      ) : null}
    </AdminPanel>
  );
}
