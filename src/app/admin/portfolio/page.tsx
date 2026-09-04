import { Suspense } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import { ContentListSkeleton } from "@/components/admin/content/content-skeletons";
import {
  EmptyTableState,
  PortfolioProjectsTable,
} from "@/components/admin/content/portfolio-list";
import { PortfolioToolbar } from "@/components/admin/content/portfolio-toolbar";
import { QueryStateNotice } from "@/components/admin/projects/query-state";
import type { ContentListFilters } from "@/lib/admin-content-constants";
import { getAdminPortfolioProjects } from "@/lib/admin-content";
import { requireAdmin } from "@/lib/require-admin";

async function PortfolioContent({ filters }: { filters: ContentListFilters }) {
  const result = await getAdminPortfolioProjects(filters);

  if (result.status === "error" || result.status === "unavailable") {
    return <QueryStateNotice result={result} />;
  }

  if (result.status === "empty" || result.data.length === 0) {
    const hasFilters = Boolean(filters.q?.trim() || filters.published || filters.featured);
    return hasFilters ? (
      <div className="rounded-3xl border border-dashed border-card-border bg-card p-8 text-center text-sm text-muted">
        No portfolio projects match the current filters.
      </div>
    ) : (
      <EmptyTableState
        message="No portfolio projects yet."
        addHref="/admin/portfolio/new"
        addLabel="Add your first project"
      />
    );
  }

  return <PortfolioProjectsTable projects={result.data} />;
}

export default async function AdminPortfolioPage({
  searchParams,
}: {
  searchParams: Promise<ContentListFilters>;
}) {
  await requireAdmin();
  const filters = await searchParams;

  return (
    <AdminPage
      title="Portfolio"
      description="Manage portfolio projects (portfolio_projects): publish, feature, reorder, add, edit and delete. Gallery images live in portfolio_project_images + Supabase Storage."
      className="mx-auto w-full max-w-6xl"
    >
      <PortfolioToolbar filters={filters} />
      <Suspense fallback={<ContentListSkeleton />}>
        <PortfolioContent filters={filters} />
      </Suspense>
    </AdminPage>
  );
}
