"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export function SignOutButton() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      return;
    }

    let cancelled = false;

    async function loadSession() {
      try {
        const supabase = createBrowserSupabaseClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!cancelled) {
          setSignedIn(Boolean(user));
        }
      } catch {
        if (!cancelled) {
          setSignedIn(false);
        }
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignOut() {
    if (!isSupabaseConfigured()) {
      return;
    }

    setSigningOut(true);

    try {
      const supabase = createBrowserSupabaseClient();
      await supabase.auth.signOut();
    } catch {
      setSigningOut(false);
      return;
    }

    setSignedIn(false);
    router.push("/login");
    router.refresh();
  }

  if (!signedIn) {
    return null;
  }

  return (
    <Button
      variant="secondary"
      onClick={handleSignOut}
      disabled={signingOut}
      className="w-full md:w-auto"
    >
      {signingOut ? "Signing out…" : "Sign Out"}
    </Button>
  );
}
