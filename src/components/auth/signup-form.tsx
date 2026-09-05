"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/form-field";
import {
  getAuthPageHref,
  getEmailRedirectTo,
  getPathnameFromNext,
  getSafeNextPath,
  isPlaceOrderAuthReason,
  isValidEmail,
} from "@/lib/auth";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";

type SignupErrors = {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

export type SignupPanelProps = {
  nextPath: string;
  placeOrder?: boolean;
  embedded?: boolean;
  idPrefix?: string;
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
  onBeforeOAuth?: () => void;
  onVerificationPending?: () => void;
};

export function SignupPanel({
  nextPath,
  placeOrder = false,
  embedded = false,
  idPrefix = "",
  onSuccess,
  onSwitchToLogin,
  onBeforeOAuth,
  onVerificationPending,
}: SignupPanelProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<SignupErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const destination = getSafeNextPath(nextPath);
  const fullNameId = `${idPrefix}fullName`;
  const emailId = `${idPrefix}email`;
  const passwordId = `${idPrefix}password`;
  const confirmPasswordId = `${idPrefix}confirmPassword`;

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
          emailRedirectTo: getEmailRedirectTo(
            window.location.origin,
            destination,
          ),
          data: {
            full_name: trimmedName,
            display_name: trimmedName.split(" ")[0] ?? trimmedName,
          },
        },
      });

      if (error) {
        console.error("Supabase sign up error:", error);
        setFormError(
          error.message || "Could not create your account. Please try again.",
        );
        setSubmitting(false);
        return;
      }

      const emailConfirmed = Boolean(data.user?.email_confirmed_at);

      if (data.session && emailConfirmed) {
        try {
          await supabase.rpc("sync_customer_session");
        } catch (rpcErr) {
          console.error("RPC error during signup:", rpcErr);
        }
        if (onSuccess) {
          onSuccess();
          return;
        }
        router.push(destination);
        router.refresh();
        return;
      }

      if (data.session && !emailConfirmed) {
        await supabase.auth.signOut();
      }

      onVerificationPending?.();
      setNotice(
        "Check your email to verify your account. You can log in after verification.",
      );
      setSubmitting(false);
    } catch (err: unknown) {
      console.error("Unexpected signup error:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Could not create your account. Please try again.";
      setFormError(message);
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
        <Field id={fullNameId} label="Full Name" required error={errors.fullName}>
          <TextInput
            id={fullNameId}
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
          id={confirmPasswordId}
          label="Confirm Password"
          required
          error={errors.confirmPassword}
        >
          <TextInput
            id={confirmPasswordId}
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

      {placeOrder && !embedded ? (
        <p className="mt-6 text-sm text-muted" role="status">
          Create an account to place your project order. Your answers are saved
          and will be waiting on the review step after you return.
        </p>
      ) : null}

      {formError ? (
        <p className="mt-6 text-sm text-accent" role="alert">
          {formError}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-6 text-sm text-muted" role="status">
          {notice}{" "}
          {onSwitchToLogin ? (
            <button
              type="button"
              className="font-medium text-accent hover:text-accent-hover"
              onClick={onSwitchToLogin}
            >
              Go to login
            </button>
          ) : (
            <Link
              href={getAuthPageHref(
                "/login",
                destination,
                placeOrder ? "place-order" : null,
              )}
              className="font-medium text-accent hover:text-accent-hover"
            >
              Go to login
            </Link>
          )}
        </p>
      ) : (
        <p className="mt-6 text-sm text-muted">
          Email and password accounts require email verification before you can
          log in.
        </p>
      )}

      <Button type="submit" className="mt-8 w-full" disabled={submitting}>
        {submitting ? "Creating account…" : "Sign up"}
      </Button>

      <OAuthButtons
        nextPath={destination}
        disabled={submitting}
        onBeforeStart={onBeforeOAuth}
      />

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        {onSwitchToLogin ? (
          <button
            type="button"
            className="font-medium text-accent hover:text-accent-hover"
            onClick={onSwitchToLogin}
          >
            Log in
          </button>
        ) : (
          <Link
            href={getAuthPageHref(
              "/login",
              destination,
              placeOrder ? "place-order" : null,
            )}
            className="font-medium text-accent hover:text-accent-hover"
          >
            Log in
          </Link>
        )}
      </p>
    </form>
  );
}

function SignupFormFields() {
  const searchParams = useSearchParams();
  const destination = getSafeNextPath(searchParams.get("next"));
  const placeOrder =
    isPlaceOrderAuthReason(searchParams.get("reason")) ||
    getPathnameFromNext(destination) === "/start-project";

  return <SignupPanel nextPath={destination} placeOrder={placeOrder} />;
}

export function SignupForm() {
  return (
    <Suspense>
      <SignupFormFields />
    </Suspense>
  );
}
