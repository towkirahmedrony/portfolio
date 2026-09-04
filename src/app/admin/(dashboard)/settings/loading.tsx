import { AdminPage } from "@/components/admin/admin-page";
import { ContentDetailSkeleton } from "@/components/admin/content/content-skeletons";

export default function AdminSettingsLoading() {
  return (
    <AdminPage
      title="Settings"
      description="Loading settings from Supabase."
      className="mx-auto w-full max-w-5xl"
    >
      <ContentDetailSkeleton />
    </AdminPage>
  );
}
