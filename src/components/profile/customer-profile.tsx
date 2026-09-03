"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AccountInfo } from "@/components/profile/account-info";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProfileInfo } from "@/components/profile/profile-info";
import { ReferralSection } from "@/components/profile/referral-section";
import { Card } from "@/components/ui/card";
import { mockCustomerReferral } from "@/data/profile";
import { mapProfileRow, toProfileUpdate } from "@/lib/profile";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type {
  CustomerAccount,
  CustomerProfile as CustomerProfileData,
  CustomerProfileDraft,
  CustomerProfileErrors,
} from "@/types/profile";

type LoadState =
  | "loading"
  | "ready"
  | "unconfigured"
  | "unauthenticated"
  | "missing"
  | "error";

function toDraft(profile: CustomerProfileData): CustomerProfileDraft {
  return {
    fullName: profile.fullName,
    displayName: profile.displayName,
    phone: profile.phone,
    companyName: profile.companyName,
    jobTitle: profile.jobTitle,
    avatarUrl: profile.avatarUrl,
  };
}

function validateDraft(draft: CustomerProfileDraft): CustomerProfileErrors {
  const errors: CustomerProfileErrors = {};

  if (draft.fullName.trim().length === 0) {
    errors.fullName = "Please enter your full name.";
  }

  if (draft.displayName.trim().length === 0) {
    errors.displayName = "Please enter a display name.";
  }

  return errors;
}

function ProfileState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="hover:translate-y-0">
      <p className="text-xs font-medium tracking-[0.22em] text-accent uppercase">
        Profile
      </p>
      <h2 className="font-display mt-2 text-2xl tracking-tight">{title}</h2>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted">{description}</p>
    </Card>
  );
}

export function CustomerProfile() {
  const [loadState, setLoadState] = useState<LoadState>(() =>
    isSupabaseConfigured() ? "loading" : "unconfigured",
  );
  const [profile, setProfile] = useState<CustomerProfileData | null>(null);
  const [account, setAccount] = useState<CustomerAccount | null>(null);
  const [draft, setDraft] = useState<CustomerProfileDraft | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<CustomerProfileErrors>({});
  const [status, setStatus] = useState<"idle" | "saved" | "cancelled">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      return;
    }

    let cancelled = false;

    async function loadProfile() {
      try {
        const supabase = createBrowserSupabaseClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (cancelled) {
          return;
        }

        if (userError) {
          setLoadState("error");
          return;
        }

        if (!user) {
          setLoadState("unauthenticated");
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select(
            "id, full_name, display_name, avatar_url, phone, company_name, job_title, role, status, email_verified, created_at, updated_at, last_seen_at",
          )
          .eq("id", user.id)
          .maybeSingle();

        if (cancelled) {
          return;
        }

        if (error) {
          setLoadState("error");
          return;
        }

        if (!data) {
          setLoadState("missing");
          return;
        }

        const mapped = mapProfileRow(data, user.email ?? "");
        setProfile(mapped.profile);
        setAccount(mapped.account);
        setDraft(toDraft(mapped.profile));
        setLoadState("ready");
      } catch {
        if (!cancelled) {
          setLoadState("error");
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  function updateDraft(field: keyof CustomerProfileDraft, value: string) {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
    setErrors((current) => {
      if (!current[field]) {
        return current;
      }
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function startEditing() {
    if (!profile) {
      return;
    }
    setDraft(toDraft(profile));
    setErrors({});
    setStatus("idle");
    setSaveError(null);
    setEditing(true);
  }

  function cancelEditing() {
    if (!profile) {
      return;
    }
    setDraft(toDraft(profile));
    setErrors({});
    setSaving(false);
    setEditing(false);
    setSaveError(null);
    setStatus("cancelled");
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft || !profile) {
      return;
    }

    const nextErrors = validateDraft(draft);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const supabase = createBrowserSupabaseClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setSaveError("You need to be signed in to save profile changes.");
        setSaving(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .update(toProfileUpdate(draft))
        .eq("id", user.id)
        .select(
          "id, full_name, display_name, avatar_url, phone, company_name, job_title, role, status, email_verified, created_at, updated_at, last_seen_at",
        )
        .maybeSingle();

      if (error || !data) {
        setSaveError("Could not save your profile. Please try again.");
        setSaving(false);
        return;
      }

      const mapped = mapProfileRow(data, user.email ?? profile.email);
      setProfile(mapped.profile);
      setAccount(mapped.account);
      setDraft(toDraft(mapped.profile));
      setEditing(false);
      setStatus("saved");
    } catch {
      setSaveError("Could not save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loadState === "loading") {
    return (
      <ProfileState
        title="Loading profile"
        description="Fetching your customer profile from your account."
      />
    );
  }

  if (loadState === "unconfigured") {
    return (
      <ProfileState
        title="Account data is not configured"
        description="Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to connect this page to your profiles table."
      />
    );
  }

  if (loadState === "unauthenticated") {
    return (
      <ProfileState
        title="Sign in to view your profile"
        description="This page loads the currently authenticated customer from public.profiles. Sign-in is not part of this screen yet."
      />
    );
  }

  if (loadState === "missing") {
    return (
      <ProfileState
        title="Profile not found"
        description="No customer profile exists for the signed-in account yet."
      />
    );
  }

  if (loadState === "error" || !profile || !account || !draft) {
    return (
      <ProfileState
        title="Could not load profile"
        description="Your profile could not be loaded from the database. Refresh the page to try again."
      />
    );
  }

  return (
    <div className="grid gap-5">
      <ProfileHeader
        profile={editing ? { ...profile, ...draft } : profile}
        editing={editing}
        status={status}
        saveError={saveError}
        onEdit={startEditing}
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <ProfileInfo
          profile={profile}
          draft={draft}
          editing={editing}
          saving={saving}
          errors={errors}
          onChange={updateDraft}
          onSave={handleSave}
          onCancel={cancelEditing}
        />
        <AccountInfo account={account} />
      </div>
      <ReferralSection referral={mockCustomerReferral} />
    </div>
  );
}
