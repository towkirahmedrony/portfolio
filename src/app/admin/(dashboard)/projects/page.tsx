import { Suspense } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import { ProjectsKanban } from "@/components/admin/projects/projects-kanban";
import { ProjectsListTable } from "@/components/admin/projects/projects-list";
import { ProjectsPagination } from "@/components/admin/projects/projects-pagination";
import { ProjectsListSkeleton } from "@/components/admin/projects/projects-skeleton";
import { ProjectsToolbar } from "@/components/admin/projects/projects-toolbar";
import { QueryStateNotice } from "@/components/admin/projects/query-state";
import {
  buildProjectsHref,
  getAdminProjects,
  type ProjectListFilters,
} from "@/lib/admin-projects";
import { requireAdmin } from "@/lib/require-admin";

async function ProjectsContent({ filters }: { filters: ProjectListFilters }) {
  const result = await getAdminProjects(filters);

  if (result.status === "error" || result.status === "unavailable") {
    return <QueryStateNotice result={result} />;
  }

  const hasFilters = Boolean(
    filters.q?.trim() ||
      (filters.status && filters.status !== "all") ||
      (filters.priority && filters.priority !== "all"),
  );

  if (result.status === "empty" || result.data.items.length === 0) {
    return (
      <QueryStateNotice
        result={{ status: "empty", data: result.data }}
        emptyMessage={
          hasFilters
            ? "No projects match the current filters."
            : "No projects have been created yet."
        }
        clearHref={
          hasFilters
            ? buildProjectsHref({
                view: filters.view,
                sort: filters.sort,
                dir: filters.dir,
              })
            : undefined
        }
      />
    );
  }

  if (filters.view === "kanban") {
    return <ProjectsKanban projects={result.data.items} />;
  }

  return (
    <>
      <ProjectsListTable projects={result.data.items} />
      <ProjectsPagination
        filters={filters}
        total={result.data.total}
        page={result.data.page}
        totalPages={result.data.totalPages}
        pageSize={result.data.pageSize}
      />
    </>
  );
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
