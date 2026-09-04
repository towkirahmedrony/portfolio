import { AdminPage } from "@/components/admin/admin-page";
import { ContentDetailSkeleton } from "@/components/admin/content/content-skeletons";

export default function AdminPortfolioProjectLoading() {
  return (
    <AdminPage
      title="Portfolio project"
      description="Loading project from Supabase."
      className="mx-auto w-full max-w-6xl"
    >
      <ContentDetailSkeleton />
    </AdminPage>
  );
}
