import type { ProfileRow, ProfileUpdate } from "@/types/database";
import type {
  CustomerAccount,
  CustomerProfile,
  CustomerProfileDraft,
} from "@/types/profile";

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatLastActive(value: string | null): string {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function mapProfileRow(
  row: ProfileRow,
  email: string,
): { profile: CustomerProfile; account: CustomerAccount } {
  return {
    profile: {
      fullName: row.full_name,
      displayName: row.display_name ?? "",
      email,
      phone: row.phone ?? "",
      companyName: row.company_name ?? "",
      jobTitle: row.job_title ?? "",
      avatarUrl: row.avatar_url ?? "",
    },
    account: {
      role: row.role,
      status: row.status,
      emailVerified: row.email_verified,
      memberSince: formatDate(row.created_at),
      lastActive: formatLastActive(row.last_seen_at),
    },
  };
}

export function toProfileUpdate(draft: CustomerProfileDraft): ProfileUpdate {
  return {
    full_name: draft.fullName.trim(),
    display_name: emptyToNull(draft.displayName),
    phone: emptyToNull(draft.phone),
    company_name: emptyToNull(draft.companyName),
    job_title: emptyToNull(draft.jobTitle),
    avatar_url: emptyToNull(draft.avatarUrl),
  };
}
