"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/form-field";
import { getSafeNextPath, isValidEmail } from "@/lib/auth";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type SignupErrors = {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

function SignupFormFields() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<SignupErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const destination = getSafeNextPath(searchParams.get("next"));

  function validate(): SignupErrors {
    const nextErrors: SignupErrors = {};

    if (fullName.trim().length === 0) {
      nextErrors.fullName = "Please enter your full name.";
    }

    if (email.trim().length === 0) {
      nextErrors.email = "Please enter your email address.";
    } else if (!isValidEmail(email)) {
      nextErrors.email = "Please enter a valid email address.";
    }

    if (password.length === 0) {
      nextErrors.password = "Please enter a password.";
    } else if (password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters.";
    }

    if (confirmPassword.length === 0) {
      nextErrors.confirmPassword = "Please confirm your password.";
    } else if (password !== confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    return nextErrors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setNotice(null);

    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    if (!isSupabaseConfigured()) {
      setFormError("Account sign-up is not configured yet.");
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createBrowserSupabaseClient();
      const trimmedName = fullName.trim();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: trimmedName,
            display_name: trimmedName.split(" ")[0] ?? trimmedName,
          },
        },
      });

      if (error) {
        setFormError("Could not create your account. Please try again.");
        setSubmitting(false);
        return;
      }

      if (data.session) {
        router.push(destination);
        router.refresh();
        return;
      }

      setNotice("Account created. Log in to continue.");
      setSubmitting(false);
    } catch {
      setFormError("Could not create your account. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-3xl border border-card-border bg-card p-5 sm:p-8"
    >
      <div className="grid gap-5">
        <Field id="fullName" label="Full Name" required error={errors.fullName}>
          <TextInput
            id="fullName"
            name="fullName"
            autoComplete="name"
            value={fullName}
            onChange={(event) => {
              setFullName(event.target.value);
              setErrors((current) => ({ ...current, fullName: undefined }));
            }}
            error={errors.fullName}
          />
        </Field>
        <Field id="email" label="Email" required error={errors.email}>
          <TextInput
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setErrors((current) => ({ ...current, email: undefined }));
            }}
            error={errors.email}
          />
        </Field>
        <Field id="password" label="Password" required error={errors.password}>
          <TextInput
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setErrors((current) => ({ ...current, password: undefined }));
            }}
            error={errors.password}
          />
        </Field>
        <Field
          id="confirmPassword"
          label="Confirm Password"
          required
          error={errors.confirmPassword}
        >
          <TextInput
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              setErrors((current) => ({
                ...current,
                confirmPassword: undefined,
              }));
            }}
            error={errors.confirmPassword}
          />
        </Field>
      </div>

      {formError ? (
        <p className="mt-6 text-sm text-accent" role="alert">
          {formError}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-6 text-sm text-muted" role="status">
          {notice}{" "}
          <Link
            href={`/login?next=${encodeURIComponent(destination)}`}
            className="font-medium text-accent hover:text-accent-hover"
          >
            Go to login
          </Link>
        </p>
      ) : null}

      <Button type="submit" className="mt-8 w-full" disabled={submitting}>
        {submitting ? "Creating account…" : "Sign up"}
      </Button>

      <OAuthButtons nextPath={destination} disabled={submitting} />

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link
          href={`/login?next=${encodeURIComponent(destination)}`}
          className="font-medium text-accent hover:text-accent-hover"
        >
          Log in
        </Link>
      </p>
    </form>
  );
}

export function SignupForm() {
  return (
    <Suspense>
      <SignupFormFields />
    </Suspense>
  );
}
