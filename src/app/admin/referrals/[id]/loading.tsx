import { AdminPage } from "@/components/admin/admin-page";
import { ReferralDetailSkeleton } from "@/components/admin/referrals/referrals-skeleton";

export default function AdminReferralDetailLoading() {
  return (
    <AdminPage
      title="Referral"
      description="Loading referral from Supabase."
      className="mx-auto w-full max-w-6xl"
    >
      <ReferralDetailSkeleton />
    </AdminPage>
  );
}
