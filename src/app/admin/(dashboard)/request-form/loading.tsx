import { AdminPage } from "@/components/admin/admin-page";
import { ContentListSkeleton } from "@/components/admin/content/content-skeletons";

export default function AdminRequestFormLoading() {
  return (
    <AdminPage
      title="Project Request Form"
      description="Loading form configuration from Supabase."
      className="mx-auto w-full max-w-6xl"
    >
      <ContentListSkeleton />
    </AdminPage>
  );
}
