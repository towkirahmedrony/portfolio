import { NotificationPreferencesCard } from "@/components/admin/settings/notification-preferences-card";
import { QueryStateNotice } from "@/components/admin/projects/query-state";
import { getOwnNotificationPreferences } from "@/lib/admin-settings";

/** Reusable section: loads the signed-in admin's notification preferences. */
export async function NotificationSettingsSection() {
  const result = await getOwnNotificationPreferences();

  if (result.status === "error" || result.status === "unavailable") {
    return <QueryStateNotice result={result} />;
  }

  return (
    <NotificationPreferencesCard
      preferences={result.data.preferences}
      exists={result.data.exists}
    />
  );
}
