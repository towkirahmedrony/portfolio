"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Field, TextArea, TextInput } from "@/components/ui/form-field";
import {
  submitContactMessage,
  type SubmitContactMessageResult,
} from "@/lib/submit-contact-message";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
      {pending ? "Sending…" : "Send message"}
    </Button>
  );
}

function ContactFields({
  fieldErrors,
  error,
}: {
  fieldErrors?: {
    name?: string;
    email?: string;
    phone?: string;
    subject?: string;
    message?: string;
  };
  error?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <fieldset disabled={pending} className="grid gap-5 disabled:opacity-70">
      <legend className="sr-only">Contact form</legend>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="contact-name" label="Name" required error={fieldErrors?.name}>
          <TextInput
            id="contact-name"
            name="name"
            type="text"
            autoComplete="name"
            maxLength={120}
            required
            error={fieldErrors?.name}
          />
        </Field>
        <Field id="contact-email" label="Email" required error={fieldErrors?.email}>
          <TextInput
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
            error={fieldErrors?.email}
          />
        </Field>
        <Field id="contact-phone" label="Phone / WhatsApp" error={fieldErrors?.phone}>
          <TextInput
            id="contact-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={40}
            error={fieldErrors?.phone}
          />
        </Field>
        <Field id="contact-subject" label="Subject" error={fieldErrors?.subject}>
          <TextInput
            id="contact-subject"
            name="subject"
            type="text"
            maxLength={200}
            error={fieldErrors?.subject}
          />
        </Field>
      </div>
      <Field id="contact-message" label="Message" required error={fieldErrors?.message}>
        <TextArea
          id="contact-message"
          name="message"
          rows={6}
          maxLength={5000}
          required
          error={fieldErrors?.message}
        />
      </Field>
      {error ? (
        <p className="text-sm text-accent" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <SubmitButton />
        <p className="text-xs leading-5 text-muted">
          I reply manually by email. No account is required.
        </p>
      </div>
    </fieldset>
  );
}

export function ContactForm() {
  const [state, formAction] = useActionState(
    submitContactMessage,
    null as SubmitContactMessageResult | null,
  );
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  if (state?.ok) {
    return (
      <div
        className="rounded-2xl border border-card-border bg-accent-soft px-5 py-8 text-center sm:px-8"
        role="status"
      >
        <p className="font-display text-xl tracking-tight">Message sent</p>
        <p className="mt-3 text-sm leading-6 text-muted">
          Thanks for getting in touch. I will reply by email as soon as I can.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} noValidate>
      <ContactFields
        fieldErrors={fieldErrors}
        error={state && !state.ok ? state.error : undefined}
      />
    </form>
  );
}
