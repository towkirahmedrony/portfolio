import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, TextInput } from "@/components/ui/form-field";
import type {
  CustomerProfile,
  CustomerProfileDraft,
  CustomerProfileErrors,
} from "@/types/profile";

export function ProfileInfo({
  profile,
  draft,
  editing,
  saving,
  errors,
  onChange,
  onSave,
  onCancel,
}: {
  profile: CustomerProfile;
  draft: CustomerProfileDraft;
  editing: boolean;
  saving: boolean;
  errors: CustomerProfileErrors;
  onChange: (field: keyof CustomerProfileDraft, value: string) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  if (!editing) {
    return null;
  }

  return (
    <Card className="hover:translate-y-0 animate-in fade-in duration-200">
      <h3 className="font-display text-xl tracking-tight">
        Edit Personal Information
      </h3>
      <p className="mt-2 text-sm leading-6 text-muted">
        Update details for this customer account. Email stays read-only.
      </p>

      <form onSubmit={onSave} noValidate className="mt-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="fullName"
            label="Full Name"
            required
            error={errors.fullName}
          >
            <TextInput
              id="fullName"
              name="fullName"
              autoComplete="name"
              value={draft.fullName}
              onChange={(event) => onChange("fullName", event.target.value)}
              error={errors.fullName}
            />
          </Field>
          <Field
            id="displayName"
            label="Display Name"
            error={errors.displayName}
          >
            <TextInput
              id="displayName"
              name="displayName"
              autoComplete="nickname"
              value={draft.displayName}
              onChange={(event) => onChange("displayName", event.target.value)}
              error={errors.displayName}
            />
          </Field>
          <Field
            id="email"
            label="Email"
            hint="Email cannot be changed from this page."
          >
            <TextInput
              id="email"
              name="email"
              type="email"
              value={profile.email}
              readOnly
              disabled
            />
          </Field>
          <Field
            id="phone"
            label="Phone / WhatsApp"
            hint="Include a country code if you prefer WhatsApp."
          >
            <TextInput
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              value={draft.phone}
              onChange={(event) => onChange("phone", event.target.value)}
            />
          </Field>
          <Field id="companyName" label="Company / Business Name">
            <TextInput
              id="companyName"
              name="companyName"
              autoComplete="organization"
              value={draft.companyName}
              onChange={(event) => onChange("companyName", event.target.value)}
            />
          </Field>
          <Field id="jobTitle" label="Job Title">
            <TextInput
              id="jobTitle"
              name="jobTitle"
              autoComplete="organization-title"
              value={draft.jobTitle}
              onChange={(event) => onChange("jobTitle", event.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field
              id="avatarUrl"
              label="Profile Avatar"
              hint="Paste an image URL. File upload will be added later."
              error={errors.avatarUrl}
            >
              <TextInput
                id="avatarUrl"
                name="avatarUrl"
                type="url"
                value={draft.avatarUrl}
                onChange={(event) => onChange("avatarUrl", event.target.value)}
                error={errors.avatarUrl}
              />
            </Field>
          </div>
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
