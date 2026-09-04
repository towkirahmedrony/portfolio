import { Suspense } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminAccessCard } from "@/components/admin/settings/admin-access-card";
import { NotificationSettingsSection } from "@/components/admin/settings/notification-settings-section";
import { ReferralSettingsSection } from "@/components/admin/settings/referral-settings-section";
import { SettingsTabs } from "@/components/admin/settings/settings-tabs";
import { ContentDetailSkeleton } from "@/components/admin/content/content-skeletons";
import { QueryStateNotice } from "@/components/admin/projects/query-state";
import { getAdminAccounts } from "@/lib/admin-settings";
import { requireAdmin } from "@/lib/require-admin";

export default async function AdminSettingsPage() {
  const session = await requireAdmin();

  const accountsResult = await getAdminAccounts(session.id);

  const tabs = [
    {
      id: "referral",
      label: "Referral settings",
      description:
        "Program defaults stored in referral_settings (5% new-client discount / 2% referrer reward when no row exists). Saved via an admin-only, range-validated database function.",
    },
    {
      id: "notifications",
      label: "Notification preferences",
      description:
        "Per-admin email preferences stored in notification_preferences — each admin manages their own row.",
    },
    {
      id: "access",
      label: "Admin & access",
      description:
        "Your signed-in identity and the active admin directory. Role management is intentionally not implemented yet.",
    },
  ];

  return (
    <AdminPage
      title="Settings"
      description="Modular settings workspace. Sections are independent components — new settings plug in without restructuring the page."
      className="mx-auto w-full max-w-5xl"
    >
      <SettingsTabs tabs={tabs}>
        <Suspense fallback={<ContentDetailSkeleton />}>
          <ReferralSettingsSection />
        </Suspense>
        <Suspense fallback={<ContentDetailSkeleton />}>
          <NotificationSettingsSection />
        </Suspense>
        {accountsResult.status === "error" || accountsResult.status === "unavailable" ? (
          <QueryStateNotice result={accountsResult} />
        ) : (
          <AdminAccessCard session={session} accountsResult={accountsResult} />
        )}
      </SettingsTabs>
    </AdminPage>
  );
}
