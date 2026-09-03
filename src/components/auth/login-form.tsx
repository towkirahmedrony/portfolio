"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/form-field";
import {
  getSafeNextPath,
  isEmailNotConfirmedError,
  isValidEmail,
} from "@/lib/auth";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type LoginErrors = {
  email?: string;
  password?: string;
};

function LoginFormFields() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<LoginErrors>({});
  const [formError, setFormError] = useState<string | null>(() => {
    const error = searchParams.get("error");
    if (error === "oauth") {
      return "Could not complete Google or GitHub sign-in. Please try again.";
    }
    if (error === "verification") {
      return "Could not verify your email. Request a new verification link by signing up again, or contact support.";
    }
    return null;
  });
  const [notice, setNotice] = useState<string | null>(
    searchParams.get("verified") === "1"
      ? "Email verified. You can log in."
      : null,
  );
  const [submitting, setSubmitting] = useState(false);
  const destination = getSafeNextPath(searchParams.get("next"));

  function validate(): LoginErrors {
    const nextErrors: LoginErrors = {};

    if (email.trim().length === 0) {
      nextErrors.email = "Please enter your email address.";
    } else if (!isValidEmail(email)) {
      nextErrors.email = "Please enter a valid email address.";
    }

    if (password.length === 0) {
      nextErrors.password = "Please enter your password.";
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
      setFormError("Account sign-in is not configured yet.");
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setFormError(
          isEmailNotConfirmedError(error)
            ? "Please verify your email before logging in. Check your inbox for the verification link."
            : "Could not log in. Check your email and password.",
        );
        setSubmitting(false);
        return;
      }

      try {
        await supabase.rpc("sync_customer_session");
      } catch {
        // Login already succeeded; profile sync retries on the next authenticated request.
      }

      router.push(destination);
      router.refresh();
    } catch {
      setFormError("Could not log in. Please try again.");
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
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setErrors((current) => ({ ...current, password: undefined }));
            }}
            error={errors.password}
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
          {notice}
        </p>
      ) : null}

      <Button type="submit" className="mt-8 w-full" disabled={submitting}>
        {submitting ? "Logging in…" : "Log in"}
      </Button>

      <OAuthButtons nextPath={destination} disabled={submitting} />

      <p className="mt-6 text-center text-sm text-muted">
        Need an account?{" "}
        <Link
          href={`/signup?next=${encodeURIComponent(destination)}`}
          className="font-medium text-accent hover:text-accent-hover"
        >
          Sign up
        </Link>
      </p>
    </form>
  );
}

export function LoginForm() {
  return (
    <Suspense>
      <LoginFormFields />
    </Suspense>
  );
}
