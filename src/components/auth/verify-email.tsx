"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  getAuthPageHref,
  getEmailRedirectTo,
  isValidEmail,
  PLACE_ORDER_AUTH_REASON,
} from "@/lib/auth";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** Client-side spam guard. Supabase also rate-limits resends server-side. */
const RESEND_COOLDOWN_SECONDS = 60;

type ResendStatus = "idle" | "sending" | "sent" | "error";

export function VerifyEmailPanel({
  email,
  nextPath,
  placeOrder,
}: {
  email: string;
  nextPath: string;
  placeOrder: boolean;
}) {
  const [cooldown, setCooldown] = useState(0);
  const [status, setStatus] = useState<ResendStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const hasEmail = isValidEmail(email);

  // If the visitor already has a confirmed session (for example they clicked the
  // link in another tab and came back), don't make them read this page again —
  // send them straight to their intended destination.
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      return;
    }

    let active = true;
    const supabase = createBrowserSupabaseClient();
    void (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (active && user?.email_confirmed_at) {
          window.location.assign(nextPath);
        }
      } catch {
        // Not signed in yet — that is the expected state here.
      }
    })();

    return () => {
      active = false;
    };
  }, [nextPath]);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const id = window.setInterval(() => {
      setCooldown((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  async function handleResend() {
    if (status === "sending" || cooldown > 0) {
      return;
    }

    if (!hasEmail) {
      setStatus("error");
      setMessage(
        "We don't have an email address to resend to. Please sign up or log in again.",
      );
      return;
    }

    if (!isSupabaseConfigured()) {
      setStatus("error");
      setMessage("Account verification is not configured yet.");
      return;
    }

    setStatus("sending");
    setMessage(null);

    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: getEmailRedirectTo(
            window.location.origin,
            nextPath,
            placeOrder ? PLACE_ORDER_AUTH_REASON : null,
          ),
        },
      });

      if (error) {
        setStatus("error");
        setMessage(
          error.message ||
            "Could not resend the verification email. Please try again.",
        );
        return;
      }

      setStatus("sent");
      setMessage("Verification email sent. Check your inbox and spam folder.");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setStatus("error");
      setMessage("Could not resend the verification email. Please try again.");
    }
  }

  return (
    <div className="rounded-3xl border border-card-border bg-card p-5 sm:p-8">
      <p className="text-sm leading-7 text-muted">
        We&apos;ve sent a verification link to
        {hasEmail ? (
          <>
            {" "}
            <span className="font-medium text-foreground">{email}</span>.{" "}
          </>
        ) : (
          " your email address. "
        )}
        Open the link to verify your account — you&apos;ll be returned to where
        you left off.
      </p>

      {placeOrder ? (
        <p className="mt-4 text-sm leading-7 text-muted" role="status">
          Your project order is saved. Once you verify your email you&apos;ll
          land back on the review step to submit it.
        </p>
      ) : null}

      {message ? (
        <p
          className={
            status === "error"
              ? "mt-6 text-sm text-accent"
              : "mt-6 text-sm text-muted"
          }
          role={status === "error" ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}

      <Button
        variant="secondary"
        className="mt-6 w-full"
        onClick={handleResend}
        disabled={status === "sending" || cooldown > 0 || !hasEmail}
      >
        {status === "sending"
          ? "Sending…"
          : cooldown > 0
            ? `Resend in ${cooldown}s`
            : "Resend verification email"}
      </Button>

      <p className="mt-6 text-center text-sm text-muted">
        Wrong address?{" "}
        <Link
          href={getAuthPageHref(
            "/signup",
            nextPath,
            placeOrder ? PLACE_ORDER_AUTH_REASON : null,
          )}
          className="font-medium text-accent hover:text-accent-hover"
        >
          Sign up again
        </Link>
      </p>

      <p className="mt-2 text-center text-sm text-muted">
        Already verified?{" "}
        <Link
          href={getAuthPageHref(
            "/login",
            nextPath,
            placeOrder ? PLACE_ORDER_AUTH_REASON : null,
          )}
          className="font-medium text-accent hover:text-accent-hover"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
