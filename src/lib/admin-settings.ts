import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { QueryResult } from "@/lib/admin-project-constants";
import type { NotificationPreferenceRow, ProfileRow } from "@/types/database";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_TOGGLES,
  type EffectiveNotificationPreferences,
} from "@/lib/notification-preference-definitions";

export * from "@/lib/notification-preference-definitions";
export type { QueryResult, NotificationPreferenceRow };

function toEffective(
  row: NotificationPreferenceRow | null,
): EffectiveNotificationPreferences {
  const next = { ...DEFAULT_NOTIFICATION_PREFERENCES };
  if (row) {
    for (const toggle of NOTIFICATION_TOGGLES) {
      next[toggle.key] = row[toggle.key];
    }
  }
  return next;
}

function isMissingRelation(error: { message?: string; code?: string } | null): boolean {
  if (!error) {
    return false;
  }
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.code === "PGRST200" ||
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find the table") ||
    message.includes("could not find a relationship")
  );
}

/**
 * The signed-in admin's own notification preferences (or the schema defaults
 * when no row exists yet). Scoped by RLS to auth.uid().
 */
export async function getOwnNotificationPreferences(): Promise<
  QueryResult<{ exists: boolean; preferences: EffectiveNotificationPreferences }>
> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingRelation(error)) {
      return {
        status: "unavailable",
        message: "notification_preferences is not available in the current database schema.",
      };
    }
    return { status: "error", message: error.message ?? "Unknown error" };
  }

  const row = data as NotificationPreferenceRow | null;
  return {
    status: "ok",
    data: { exists: row !== null, preferences: toEffective(row) },
  };
}

export type AdminAccountListItem = {
  id: string;
  name: string;
  isCurrent: boolean;
};

/** Read-only list of active admins (multi-admin awareness, no management yet). */
export async function getAdminAccounts(
  currentUserId: string,
): Promise<QueryResult<AdminAccountListItem[]>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, display_name")
    .eq("role", "admin")
    .eq("status", "active")
    .order("full_name", { ascending: true });

  if (error) {
    if (isMissingRelation(error)) {
      return { status: "unavailable", message: error.message };
    }
    return { status: "error", message: error.message ?? "Unknown error" };
  }

  const items: AdminAccountListItem[] = ((data ?? []) as Pick<
    ProfileRow,
    "id" | "full_name" | "display_name"
  >[]).map((profile) => ({
    id: profile.id,
    name: profile.display_name?.trim() || profile.full_name.trim() || "Unknown",
    isCurrent: profile.id === currentUserId,
  }));

  return items.length === 0
    ? { status: "empty", data: items }
    : { status: "ok", data: items };
}
