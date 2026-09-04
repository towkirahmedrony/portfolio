import { AdminPage } from "@/components/admin/admin-page";
import { ProjectRequestsListSkeleton } from "@/components/admin/project-requests/project-requests-skeleton";

export default function AdminProjectRequestsLoading() {
  return (
    <AdminPage
      title="Project Requests"
      description="Loading project requests from Supabase."
      className="mx-auto w-full max-w-7xl"
    >
      <ProjectRequestsListSkeleton />
    </AdminPage>
  );
}
