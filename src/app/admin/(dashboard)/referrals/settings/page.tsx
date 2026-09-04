import Link from "next/link";
import { AdminPage } from "@/components/admin/admin-page";
import { QueryStateNotice } from "@/components/admin/projects/query-state";
import { ReferralSettingsForm } from "@/components/admin/referrals/referral-settings-form";
import { getReferralSettings } from "@/lib/admin-referrals";
import { toReferralProgramSettings } from "@/lib/referral-rules";
import { requireAdmin } from "@/lib/require-admin";

export default async function AdminReferralSettingsPage() {
  await requireAdmin();
  const settingsResult = await getReferralSettings();

  return (
    <AdminPage
      title="Referral settings"
      description="Manage the referral program: new-client discount, referrer reward, minimum project amount, reward validity and program state."
      className="mx-auto w-full max-w-6xl"
    >
      <Link
        href="/admin/referrals"
        className="mb-6 inline-block text-sm text-muted hover:text-foreground"
      >
        Back to referrals
      </Link>
      {settingsResult.status === "error" || settingsResult.status === "unavailable" ? (
        <QueryStateNotice result={settingsResult} />
      ) : (
        <ReferralSettingsForm
          settings={toReferralProgramSettings(settingsResult.data)}
          usingDefaults={settingsResult.data === null}
        />
      )}
    </AdminPage>
  );
}
