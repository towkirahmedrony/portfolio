import { AdminPage } from "@/components/admin/admin-page";
import { ContentListSkeleton } from "@/components/admin/content/content-skeletons";

export default function AdminReviewsLoading() {
  return (
    <AdminPage
      title="Reviews"
      description="Loading reviews from Supabase."
      className="mx-auto w-full max-w-4xl"
    >
      <ContentListSkeleton />
    </AdminPage>
  );
}
