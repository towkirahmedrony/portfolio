import type { ReactNode } from "react";
import { PhotoUploadField } from "@/components/admin/photo-upload-field";
import { ActionForm } from "@/components/admin/projects/action-form";
import { ConfirmSubmitButton } from "@/components/admin/projects/confirm-button";
import { AdminPanel, StatusPill } from "@/components/admin/projects/query-state";
import {
  saveClientAvatar,
  setClientEmailVerified,
  setClientStatus,
} from "@/lib/admin-client-actions";
import {
  EMAIL_VERIFIED_STYLES,
  formatClientStatusLabel,
  formatDate,
  formatDateTime,
  getClientStatusStyle,
  type AdminClientDetail,
} from "@/lib/admin-client-constants";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  );
}

const statusButtonClass =
  "rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background";
const dangerButtonClass = "rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white";

export function ClientAccountCard({ client }: { client: AdminClientDetail }) {
  const isActive = client.status === "active";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <AdminPanel
        title="Profile"
        description="Account data from the profiles table (1:1 with auth.users). Email is read from auth.users for display only."
      >
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <Field label="Full name">{client.full_name || "—"}</Field>
          <Field label="Display name">{client.display_name?.trim() || "—"}</Field>
          <Field label="Email">{client.email ?? "—"}</Field>
          <Field label="Phone">{client.phone || "—"}</Field>
          <Field label="Company">{client.company_name || "—"}</Field>
          <Field label="Job title">{client.job_title || "—"}</Field>
          <Field label="Role">Client</Field>
          <div>
            <dt className="text-muted">Account status</dt>
            <dd className="mt-1">
              <StatusPill
                label={formatClientStatusLabel(client.status)}
                className={getClientStatusStyle(client.status)}
              />
            </dd>
          </div>
          <div>
            <dt className="text-muted">Email verified</dt>
            <dd className="mt-1">
              <StatusPill
                label={client.email_verified ? "Verified" : "Unverified"}
                className={
                  client.email_verified
                    ? EMAIL_VERIFIED_STYLES.verified
                    : EMAIL_VERIFIED_STYLES.unverified
                }
              />
            </dd>
          </div>
          <Field label="Member since">{formatDate(client.created_at)}</Field>
          <Field label="Last active">
            {formatDateTime(client.last_seen_at)}
          </Field>
          <Field label="Last updated">{formatDateTime(client.updated_at)}</Field>
          <div className="sm:col-span-2">
            <PhotoUploadField
              folder="clients"
              entityId={client.id}
              currentUrl={client.avatar_url}
              label="Client photo"
              hint="Upload from your gallery or files. Saved to this client immediately."
              persist={saveClientAvatar.bind(null, client.id)}
            />
          </div>
        </dl>
      </AdminPanel>

      <AdminPanel
        title="Account actions"
        description="Writes are enforced server-side: admin-only RPCs that only ever update client rows — protected fields (id, role, created_at…) can never be changed and Supabase Auth is never modified from the browser."
      >
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-sm text-muted">Account status</p>
            {isActive ? (
              <ActionForm
                action={setClientStatus}
                successMessage="Client account suspended."
              >
                <input type="hidden" name="clientId" value={client.id} />
                <input type="hidden" name="status" value="suspended" />
                <ConfirmSubmitButton
                  message="Suspend this client account? They will lose access to the client portal until reactivated."
                  className={dangerButtonClass}
                >
                  Suspend account
                </ConfirmSubmitButton>
              </ActionForm>
            ) : (
              <ActionForm
                action={setClientStatus}
                successMessage="Client account activated."
              >
                <input type="hidden" name="clientId" value={client.id} />
                <input type="hidden" name="status" value="active" />
                <ConfirmSubmitButton
                  message="Activate this client account? They will regain access to the client portal."
                  className={statusButtonClass}
                >
                  Activate account
                </ConfirmSubmitButton>
              </ActionForm>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm text-muted">Email verification status</p>
            <p className="mb-3 text-xs leading-5 text-muted">
              Normally synced from Supabase Auth (email confirmation / Google
              identity). Manual override is an admin support tool and only
              changes the profile flag until the next auth sync.
            </p>
            <ActionForm
              action={setClientEmailVerified}
              successMessage={
                client.email_verified
                  ? "Marked as unverified."
                  : "Marked as verified."
              }
            >
              <input type="hidden" name="clientId" value={client.id} />
              <input
                type="hidden"
                name="emailVerified"
                value={client.email_verified ? "false" : "true"}
              />
              <ConfirmSubmitButton
                message={
                  client.email_verified
                    ? "Mark this client's email as unverified? The flag may be re-synced from Supabase Auth on the next auth change."
                    : "Mark this client's email as verified? The flag may be re-synced from Supabase Auth on the next auth change."
                }
                className={statusButtonClass}
              >
                {client.email_verified ? "Mark unverified" : "Mark verified"}
              </ConfirmSubmitButton>
            </ActionForm>
          </div>
        </div>
      </AdminPanel>
    </div>
  );
}
