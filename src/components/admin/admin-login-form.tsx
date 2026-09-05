"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/form-field";
import { decideAdminAccess } from "@/lib/admin-access";
import {
  getSafeAdminNextPath,
  isEmailNotConfirmedError,
  isValidEmail,
} from "@/lib/auth";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type LoginErrors = {
  email?: string;
  password?: string;
};

function AdminLoginFormFields() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<LoginErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const destination = getSafeAdminNextPath(searchParams.get("next"));

  function validate(): LoginErrors {
    const nextErrors: LoginErrors = {};

    if (email.trim().length === 0) {
      nextErrors.email = "Please enter your admin email address.";
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

    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    if (!isSupabaseConfigured()) {
      setFormError("Admin sign-in is not configured yet.");
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createBrowserSupabaseClient();
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error || !authData.user) {
        setFormError(
          isEmailNotConfirmedError(error)
            ? "Please verify your email before logging in."
            : "Could not log in. Check your email and password.",
        );
        setSubmitting(false);
        return;
      }

      try {
        await supabase.rpc("sync_customer_session");
      } catch {
        // Role verification below does not depend on session activity sync.
      }

      const { data: isAdmin, error: adminCheckError } = await supabase.rpc(
        "is_active_admin",
      );

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, display_name, role, status")
        .eq("id", authData.user.id)
        .maybeSingle();

      const decision = decideAdminAccess({
        hasUser: true,
        isAdminRpc: isAdmin ?? null,
        rpcError: Boolean(adminCheckError),
        profile,
      });

      if (decision !== "allow") {
        await supabase.auth.signOut();
        setFormError(
          "This account does not have admin access. Use the customer login instead.",
        );
        setSubmitting(false);
        return;
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
      <p className="mb-6 text-xs font-medium tracking-[0.22em] text-accent uppercase">
        Restricted access
      </p>
      <div className="grid gap-5">
        <Field id="admin-email" label="Admin email" required error={errors.email}>
          <TextInput
            id="admin-email"
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setErrors((current) => ({ ...current, email: undefined }));
            }}
            error={errors.email}
          />
        </Field>
        <Field id="admin-password" label="Password" required error={errors.password}>
          <TextInput
            id="admin-password"
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

      <Button type="submit" className="mt-8 w-full" disabled={submitting}>
        {submitting ? "Signing in…" : "Sign in to admin"}
      </Button>

      <p className="mt-6 text-center text-sm text-muted">
        Admin accounts are provisioned privately. There is no public sign up,
        Google, or GitHub access on this page.
      </p>
      <p className="mt-3 text-center text-sm text-muted">
        Looking for the customer account?{" "}
        <Link href="/login" className="font-medium text-accent hover:text-accent-hover">
          Customer login
        </Link>
      </p>
    </form>
  );
}

export function AdminLoginForm() {
  return (
    <Suspense>
      <AdminLoginFormFields />
    </Suspense>
  );
}
