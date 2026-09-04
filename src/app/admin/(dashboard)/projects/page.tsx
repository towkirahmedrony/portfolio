import { Suspense } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import { ProjectsKanban } from "@/components/admin/projects/projects-kanban";
import { ProjectsListTable } from "@/components/admin/projects/projects-list";
import { ProjectsListSkeleton } from "@/components/admin/projects/projects-skeleton";
import { ProjectsToolbar } from "@/components/admin/projects/projects-toolbar";
import { QueryStateNotice } from "@/components/admin/projects/query-state";
import { getAdminProjects, type ProjectListFilters } from "@/lib/admin-projects";
import { requireAdmin } from "@/lib/require-admin";

async function ProjectsContent({ filters }: { filters: ProjectListFilters }) {
  const result = await getAdminProjects(filters);

  if (result.status === "error" || result.status === "unavailable") {
    return <QueryStateNotice result={result} />;
  }

  if (result.status === "empty") {
    return (
      <QueryStateNotice
        result={result}
        emptyMessage="No projects match the current filters."
      />
    );
  }

  if (filters.view === "kanban") {
    return <ProjectsKanban projects={result.data} />;
  }

  return <ProjectsListTable projects={result.data} />;
}

export default async function AdminProjectsPage({
  searchParams,
}: {
  searchParams: Promise<ProjectListFilters>;
}) {
  await requireAdmin();
  const filters = await searchParams;

  return (
    <AdminPage
      title="Projects"
      description="Manage confirmed projects. Switch between list and kanban, then filter by status, priority, or search."
      className="mx-auto w-full max-w-6xl"
    >
      <ProjectsToolbar filters={filters} />
      <Suspense fallback={<ProjectsListSkeleton />}>
        <ProjectsContent filters={filters} />
      </Suspense>
    </AdminPage>
  );
}
