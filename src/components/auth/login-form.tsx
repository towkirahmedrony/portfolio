"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/form-field";
import {
  getAuthPageHref,
  getPathnameFromNext,
  getSafeNextPath,
  isEmailNotConfirmedError,
  isPlaceOrderAuthReason,
  isValidEmail,
} from "@/lib/auth";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";

type LoginErrors = {
  email?: string;
  password?: string;
};

export type LoginPanelProps = {
  nextPath: string;
  placeOrder?: boolean;
  embedded?: boolean;
  idPrefix?: string;
  initialError?: string | null;
  initialNotice?: string | null;
  onSuccess?: () => void;
  onSwitchToSignup?: () => void;
  onBeforeOAuth?: () => void;
};

export function LoginPanel({
  nextPath,
  placeOrder = false,
  embedded = false,
  idPrefix = "",
  initialError = null,
  initialNotice = null,
  onSuccess,
  onSwitchToSignup,
  onBeforeOAuth,
}: LoginPanelProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<LoginErrors>({});
  const [formError, setFormError] = useState<string | null>(initialError);
  const [notice, setNotice] = useState<string | null>(initialNotice);
  const [submitting, setSubmitting] = useState(false);
  const destination = getSafeNextPath(nextPath);
  const emailId = `${idPrefix}email`;
  const passwordId = `${idPrefix}password`;

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
      const { data: authData, error } = await supabase.auth.signInWithPassword({
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

      if (authData?.user?.id) {
        try {
          await supabase.rpc("sync_customer_session");
        } catch {
          await supabase
            .from("profiles")
            .update({ last_seen_at: new Date().toISOString() })
            .eq("id", authData.user.id);
        }
      }

      if (onSuccess) {
        onSuccess();
        return;
      }

      window.location.assign(destination);
    } catch (err) {
      console.error(err);
      setFormError("Could not log in. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={cn(
        !embedded && "rounded-3xl border border-card-border bg-card p-5 sm:p-8",
      )}
    >
      <div className="grid gap-5">
        <Field id={emailId} label="Email" required error={errors.email}>
          <TextInput
            id={emailId}
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
        <Field id={passwordId} label="Password" required error={errors.password}>
          <TextInput
            id={passwordId}
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

      {placeOrder && !embedded ? (
        <p className="mt-6 text-sm text-muted" role="status">
          Sign in to place your project order. Your answers are saved and will
          be waiting on the review step after you return.
        </p>
      ) : null}

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

      <OAuthButtons
        nextPath={destination}
        disabled={submitting}
        onBeforeStart={onBeforeOAuth}
      />

      <p className="mt-6 text-center text-sm text-muted">
        Need an account?{" "}
        {onSwitchToSignup ? (
          <button
            type="button"
            className="font-medium text-accent hover:text-accent-hover"
            onClick={onSwitchToSignup}
          >
            Sign up
          </button>
        ) : (
          <Link
            href={getAuthPageHref(
              "/signup",
              destination,
              placeOrder ? "place-order" : null,
            )}
            className="font-medium text-accent hover:text-accent-hover"
          >
            Sign up
          </Link>
        )}
      </p>
    </form>
  );
}

function LoginFormFields() {
  const searchParams = useSearchParams();
  const destination = getSafeNextPath(searchParams.get("next"));
  const placeOrder =
    isPlaceOrderAuthReason(searchParams.get("reason")) ||
    getPathnameFromNext(destination) === "/start-project";
  const error = searchParams.get("error");
  const initialError =
    error === "oauth"
      ? "Could not complete Google or GitHub sign-in. Please try again."
      : error === "verification"
        ? "Could not verify your email. Request a new verification link by signing up again, or contact support."
        : null;
  const initialNotice =
    searchParams.get("verified") === "1" ? "Email verified. You can log in." : null;

  return (
    <LoginPanel
      nextPath={destination}
      placeOrder={placeOrder}
      initialError={initialError}
      initialNotice={initialNotice}
    />
  );
}

export function LoginForm() {
  return (
    <Suspense>
      <LoginFormFields />
    </Suspense>
  );
}
