import { AdminPage } from "@/components/admin/admin-page";
import { ContentListSkeleton } from "@/components/admin/content/content-skeletons";

export default function AdminContactMessagesLoading() {
  return (
    <AdminPage
      title="Contact Inbox"
      description="Loading messages from Supabase."
      className="mx-auto w-full max-w-6xl"
    >
      <ContentListSkeleton />
    </AdminPage>
  );
}
