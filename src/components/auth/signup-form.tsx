"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Button } from "@/components/ui/button";
import { Field, PasswordInput, TextInput } from "@/components/ui/form-field";
import {
  getAuthPageHref,
  getEmailRedirectTo,
  getPathnameFromNext,
  getVerifyEmailHref,
  isPlaceOrderAuthReason,
  isValidEmail,
  persistAuthReturnTo,
  PLACE_ORDER_AUTH_REASON,
  resolvePostAuthRedirect,
} from "@/lib/auth";
import {
  clearPendingReferralCode,
  isPlausibleReferralCode,
  normalizeReferralCode,
  readPendingReferralCode,
  readReferralCodeParam,
  writePendingReferralCode,
} from "@/lib/referral-code";
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
  /**
   * Candidate referral code from /signup?ref=... . Only ever a suggestion: the
   * database re-validates it (existence, active, expiry, self-referral) before
   * any referral row is created, and the visitor can never edit the referrer.
   */
  referralCode?: string;
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
  onBeforeOAuth?: () => void;
};

export function SignupPanel({
  nextPath,
  placeOrder = false,
  embedded = false,
  idPrefix = "",
  referralCode = "",
  onSuccess,
  onSwitchToLogin,
  onBeforeOAuth,
}: SignupPanelProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<SignupErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const destination = resolvePostAuthRedirect({
    next: nextPath,
    reason: placeOrder ? PLACE_ORDER_AUTH_REASON : null,
  });
  const fullNameId = `${idPrefix}fullName`;
  const emailId = `${idPrefix}email`;
  const passwordId = `${idPrefix}password`;
  const confirmPasswordId = `${idPrefix}confirmPassword`;
  const normalizedReferralCode = normalizeReferralCode(referralCode);
  const referralApplied = isPlausibleReferralCode(normalizedReferralCode);

  // Persist the candidate code so it survives moves between signup/auth screens
  // and the email verification or OAuth round trip. This only writes to an
  // external system; the value is re-validated in the database, so a stale or
  // tampered code can never create a referral on its own.
  useEffect(() => {
    if (!referralApplied) {
      return;
    }
    writePendingReferralCode(normalizedReferralCode);
  }, [normalizedReferralCode, referralApplied]);

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

    // Prefer the code on the URL, but fall back to the one captured earlier in
    // this session (the two can differ if the visitor navigated back to
    // /signup without the query string). The database validates it either way.
    const pendingReferralCode =
      normalizedReferralCode ||
      normalizeReferralCode(readPendingReferralCode());
    const hasReferralCode = isPlausibleReferralCode(pendingReferralCode);

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
            placeOrder ? PLACE_ORDER_AUTH_REASON : null,
          ),
          data: {
            full_name: trimmedName,
            display_name: trimmedName.split(" ")[0] ?? trimmedName,
            ...(hasReferralCode ? { referral_code: pendingReferralCode } : {}),
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

      // When email confirmation is required, Supabase creates the user and
      // emails a verification link but returns NO session here. That is the
      // correct, secure outcome: we must never sign in with the password to
      // fabricate a verified session — that attempt fails with "Email not
      // confirmed" and is exactly what made email/password sign-up dead-end
      // before. Send the visitor to the check-your-email state instead, with
      // the intended destination carried along.
      if (!data.session) {
        // With confirmation on, Supabase returns an obfuscated user (empty
        // `identities`) when the address is already registered and sends no
        // email, so we must not claim an email was sent.
        const alreadyRegistered =
          Array.isArray(data.user?.identities) &&
          data.user.identities.length === 0;

        if (alreadyRegistered) {
          setFormError(
            "An account with this email already exists. Log in instead, or reset your password.",
          );
          setSubmitting(false);
          return;
        }

        persistAuthReturnTo(
          destination,
          placeOrder ? PLACE_ORDER_AUTH_REASON : null,
        );
        router.push(
          getVerifyEmailHref(
            email.trim(),
            destination,
            placeOrder ? PLACE_ORDER_AUTH_REASON : null,
          ),
        );
        return;
      }

      try {
        await supabase.rpc("sync_customer_session");
      } catch (rpcErr) {
        console.error("RPC error during signup:", rpcErr);
      }

      // The signup trigger already applies the referral from the auth
      // metadata. This call is an idempotent safety net for the case where
      // that metadata never reached the trigger; the database decides whether
      // the code is usable, so the result is never trusted here.
      if (hasReferralCode) {
        try {
          const { error: claimError } = await supabase.rpc(
            "claim_my_referral",
            { p_code: pendingReferralCode },
          );
          if (!claimError) {
            clearPendingReferralCode();
          }
        } catch (rpcErr) {
          console.error("Referral claim error during signup:", rpcErr);
        }
      }

      if (onSuccess) {
        onSuccess();
        return;
      }
      persistAuthReturnTo(
        destination,
        placeOrder ? PLACE_ORDER_AUTH_REASON : null,
      );
      router.push(destination);
      router.refresh();
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
          <PasswordInput
            id={passwordId}
            name="password"
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
          <PasswordInput
            id={confirmPasswordId}
            name="confirmPassword"
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

      {referralApplied ? (
        <p className="mt-6 text-sm text-muted" role="status">
          Referral applied — code{" "}
          <span className="font-medium tracking-[0.08em] text-foreground">
            {normalizedReferralCode}
          </span>{" "}
          is saved with this sign-up and is verified when your account is
          created.
        </p>
      ) : null}

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

      <Button type="submit" className="mt-8 w-full" disabled={submitting}>
        {submitting ? "Creating account…" : "Sign up"}
      </Button>

      <OAuthButtons
        nextPath={destination}
        reason={placeOrder ? PLACE_ORDER_AUTH_REASON : null}
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
  const destination = resolvePostAuthRedirect({
    next: searchParams.get("next"),
    reason: searchParams.get("reason"),
  });
  const placeOrder =
    isPlaceOrderAuthReason(searchParams.get("reason")) ||
    getPathnameFromNext(destination) === "/start-project";
  const referralCode = readReferralCodeParam(searchParams.get("ref"));

  return (
    <SignupPanel
      nextPath={destination}
      placeOrder={placeOrder}
      referralCode={referralCode}
    />
  );
}

export function SignupForm() {
  return (
    <Suspense>
      <SignupFormFields />
    </Suspense>
  );
}
