"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  getAuthCallbackUrl,
  persistAuthReturnTo,
  resolvePostAuthRedirect,
} from "@/lib/auth";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type OAuthProvider = "google" | "github";

export function OAuthButtons({
  nextPath,
  reason,
  disabled,
  onBeforeStart,
}: {
  nextPath: string;
  reason?: string | null;
  disabled?: boolean;
  onBeforeStart?: () => void;
}) {
  const [provider, setProvider] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const destination = resolvePostAuthRedirect({ next: nextPath, reason });

  async function startOAuth(nextProvider: OAuthProvider) {
    setError(null);

    if (!isSupabaseConfigured()) {
      setError("Account sign-in is not configured yet.");
      return;
    }

    setProvider(nextProvider);
    persistAuthReturnTo(destination, reason);
    onBeforeStart?.();

    try {
      const supabase = createBrowserSupabaseClient();
      const redirectTo = getAuthCallbackUrl(
        window.location.origin,
        destination,
        reason,
      );
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: nextProvider,
        options: {
          redirectTo,
        },
      });

      if (oauthError) {
        setError("Could not start sign-in. Please try again.");
        setProvider(null);
      }
    } catch {
      setError("Could not start sign-in. Please try again.");
      setProvider(null);
    }
  }

  const busy = provider !== null;

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-card-border" />
        <span className="text-xs tracking-[0.16em] text-muted uppercase">
          Or continue with
        </span>
        <span className="h-px flex-1 bg-card-border" />
      </div>

      <div className="mt-4 grid gap-3">
        <Button
          variant="secondary"
          className="w-full"
          disabled={disabled || busy}
          onClick={() => startOAuth("google")}
        >
          {provider === "google" ? "Continuing…" : "Continue with Google"}
        </Button>
        <Button
          variant="secondary"
          className="w-full"
          disabled={disabled || busy}
          onClick={() => startOAuth("github")}
        >
          {provider === "github" ? "Continuing…" : "Continue with GitHub"}
        </Button>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-accent" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
