import { AdminPage } from "@/components/admin/admin-page";
import { ContentListSkeleton } from "@/components/admin/content/content-skeletons";

export default function AdminServicesLoading() {
  return (
    <AdminPage
      title="Services"
      description="Loading services from Supabase."
      className="mx-auto w-full max-w-6xl"
    >
      <ContentListSkeleton />
    </AdminPage>
  );
}
