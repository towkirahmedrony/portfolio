import { AdminPage } from "@/components/admin/admin-page";
import { ContentListSkeleton } from "@/components/admin/content/content-skeletons";

export default function AdminPortfolioLoading() {
  return (
    <AdminPage
      title="Portfolio"
      description="Loading portfolio projects from Supabase."
      className="mx-auto w-full max-w-6xl"
    >
      <ContentListSkeleton />
    </AdminPage>
  );
}
