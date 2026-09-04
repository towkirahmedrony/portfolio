import { Suspense } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import { ProjectRequestsListTable } from "@/components/admin/project-requests/project-requests-list";
import { ProjectRequestsListSkeleton } from "@/components/admin/project-requests/project-requests-skeleton";
import { ProjectRequestsToolbar } from "@/components/admin/project-requests/project-requests-toolbar";
import { QueryStateNotice } from "@/components/admin/projects/query-state";
import {
  getAdminProjectRequests,
  type ProjectRequestListFilters,
} from "@/lib/admin-project-requests";
import { requireAdmin } from "@/lib/require-admin";

async function ProjectRequestsContent({
  filters,
}: {
  filters: ProjectRequestListFilters;
}) {
  const result = await getAdminProjectRequests(filters);

  if (result.status === "error" || result.status === "unavailable") {
    return <QueryStateNotice result={result} />;
  }

  if (result.status === "empty") {
    const hasFilters = Boolean(
      filters.q?.trim() || (filters.status && filters.status !== "all"),
    );
    return (
      <QueryStateNotice
        result={result}
        emptyMessage={
          hasFilters
            ? "No project requests match the current filters."
            : "No project requests have been submitted yet."
        }
      />
    );
  }

  return <ProjectRequestsListTable requests={result.data} />;
}

export default async function AdminProjectRequestsPage({
  searchParams,
}: {
  searchParams: Promise<ProjectRequestListFilters>;
}) {
  await requireAdmin();
  const filters = await searchParams;

  return (
    <AdminPage
      title="Project Requests"
      description="Incoming leads from the /start-project form. Filter by status, search the submitted fields, and open a request to review or convert it."
      className="mx-auto w-full max-w-7xl"
    >
      <ProjectRequestsToolbar filters={filters} />
      <Suspense fallback={<ProjectRequestsListSkeleton />}>
        <ProjectRequestsContent filters={filters} />
      </Suspense>
    </AdminPage>
  );
}
