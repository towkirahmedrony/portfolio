import { AdminPage } from "@/components/admin/admin-page";
import { ContentListSkeleton } from "@/components/admin/content/content-skeletons";

export default function AdminAuditLogsLoading() {
  return (
    <AdminPage
      title="Audit Logs"
      description="Loading audit entries from Supabase."
      className="mx-auto w-full max-w-6xl"
    >
      <ContentListSkeleton />
    </AdminPage>
  );
}
