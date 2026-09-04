import { AdminPage } from "@/components/admin/admin-page";
import { ContentDetailSkeleton } from "@/components/admin/content/content-skeletons";

export default function AdminServiceDetailLoading() {
  return (
    <AdminPage
      title="Service"
      description="Loading service from Supabase."
      className="mx-auto w-full max-w-6xl"
    >
      <ContentDetailSkeleton />
    </AdminPage>
  );
}
