import { AdminPage } from "@/components/admin/admin-page";
import { ProjectsListSkeleton } from "@/components/admin/projects/projects-skeleton";

export default function AdminProjectsLoading() {
  return (
    <AdminPage
      title="Projects"
      description="Loading projects from Supabase."
      className="mx-auto w-full max-w-6xl"
    >
      <ProjectsListSkeleton />
    </AdminPage>
  );
}
