import { AdminPage } from "@/components/admin/admin-page";
import { ReferralSettingsSkeleton } from "@/components/admin/referrals/referrals-skeleton";

export default function AdminReferralSettingsLoading() {
  return (
    <AdminPage
      title="Referral settings"
      description="Loading referral settings from Supabase."
      className="mx-auto w-full max-w-6xl"
    >
      <ReferralSettingsSkeleton />
    </AdminPage>
  );
}
