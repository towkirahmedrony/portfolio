import { AdminPage } from "@/components/admin/admin-page";
import { ReferralsListSkeleton } from "@/components/admin/referrals/referrals-skeleton";

export default function AdminReferralsLoading() {
  return (
    <AdminPage
      title="Referrals"
      description="Loading referral data from Supabase."
      className="mx-auto w-full max-w-7xl"
    >
      <ReferralsListSkeleton />
    </AdminPage>
  );
}
