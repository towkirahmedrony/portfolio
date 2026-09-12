import { AdminPage } from "@/components/admin/admin-page";
import { ContentListSkeleton } from "@/components/admin/content/content-skeletons";

export default function AdminAiLoading() {
  return (
    <AdminPage
      title="AI"
      description="Loading Nora's AI control center."
      className="mx-auto w-full max-w-7xl"
    >
      <ContentListSkeleton />
    </AdminPage>
  );
}
