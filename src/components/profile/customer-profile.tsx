"use client";

import { useState, type FormEvent } from "react";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProfileInfo } from "@/components/profile/profile-info";
import { ProjectTracking } from "@/components/profile/project-tracking";
import { ReferralSection } from "@/components/profile/referral-section";
import { mapProfileRow, toProfileUpdate } from "@/lib/profile";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  CustomerAccount,
  CustomerProfile as CustomerProfileData,
  CustomerProfileDraft,
  CustomerProfileErrors,
  CustomerReferral,
} from "@/types/profile";

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
  return errors;
}

export function CustomerProfile({
  initialProfile,
  initialAccount,
  initialReferral
}: {
  initialProfile: CustomerProfileData;
  initialAccount: CustomerAccount;
  initialReferral: CustomerReferral;
}) {
  const [profile, setProfile] = useState<CustomerProfileData>(initialProfile);
  const [account, setAccount] = useState<CustomerAccount>(initialAccount);
  const [draft, setDraft] = useState<CustomerProfileDraft | null>(null);
  
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<CustomerProfileErrors>({});
  const [status, setStatus] = useState<"idle" | "saved" | "cancelled">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  function updateDraft(field: keyof CustomerProfileDraft, value: string) {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function startEditing() {
    setDraft(toDraft(profile));
    setErrors({});
    setStatus("idle");
    setSaveError(null);
    setEditing(true);
  }

  function cancelEditing() {
    setDraft(toDraft(profile));
    setErrors({});
    setSaving(false);
    setEditing(false);
    setSaveError(null);
    setStatus("cancelled");
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft) return;

    const nextErrors = validateDraft(draft);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const supabase = createBrowserSupabaseClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        setSaveError("You need to be signed in to save profile changes.");
        setSaving(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .update(toProfileUpdate(draft))
        .eq("id", user.id)
        .select("id, full_name, display_name, avatar_url, phone, company_name, job_title, role, status, email_verified, created_at, updated_at, last_seen_at")
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

  return (
    <div className="grid gap-5">
      <ProfileHeader
        profile={editing && draft ? { ...profile, ...draft } : profile}
        role={account.role}
        editing={editing}
        status={status}
        saveError={saveError}
        onEdit={startEditing}
      />
      <div>
        {draft && (
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
        )}
      </div>
      <ProjectTracking />
      <ReferralSection referral={initialReferral} />
    </div>
  );
}
