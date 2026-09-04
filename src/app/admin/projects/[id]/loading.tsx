import { AdminPage } from "@/components/admin/admin-page";
import { ProjectDetailSkeleton } from "@/components/admin/projects/projects-skeleton";

export default function AdminProjectDetailLoading() {
  return (
    <AdminPage
      title="Project"
      description="Loading project details."
      className="mx-auto w-full max-w-6xl"
    >
      <ProjectDetailSkeleton />
    </AdminPage>
  );
}
