import { AdminPage } from "@/components/admin/admin-page";
import { ProjectRequestDetailSkeleton } from "@/components/admin/project-requests/project-requests-skeleton";

export default function AdminProjectRequestDetailLoading() {
  return (
    <AdminPage
      title="Project request"
      description="Loading request details."
      className="mx-auto w-full max-w-6xl"
    >
      <ProjectRequestDetailSkeleton />
    </AdminPage>
  );
}
