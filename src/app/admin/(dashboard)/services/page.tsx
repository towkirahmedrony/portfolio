import { Suspense } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import { ContentListSkeleton } from "@/components/admin/content/content-skeletons";
import {
  EmptyTableState,
} from "@/components/admin/content/portfolio-list";
import { ServicesTable } from "@/components/admin/content/services-list";
import { ServicesToolbar } from "@/components/admin/content/services-toolbar";
import { QueryStateNotice } from "@/components/admin/projects/query-state";
import type { ContentListFilters } from "@/lib/admin-content-constants";
import { getAdminServices } from "@/lib/admin-content";
import { requireAdmin } from "@/lib/require-admin";

async function ServicesContent({ filters }: { filters: ContentListFilters }) {
  const result = await getAdminServices(filters);

  if (result.status === "error" || result.status === "unavailable") {
    return <QueryStateNotice result={result} />;
  }

  if (result.status === "empty" || result.data.length === 0) {
    const hasFilters = Boolean(filters.q?.trim() || filters.published || filters.featured);
    return hasFilters ? (
      <div className="rounded-3xl border border-dashed border-card-border bg-card p-8 text-center text-sm text-muted">
        No services match the current filters.
      </div>
    ) : (
      <EmptyTableState
        message="No services yet."
        addHref="/admin/services/new"
        addLabel="Add your first service"
      />
    );
  }

  return <ServicesTable services={result.data} />;
}

export default async function AdminServicesPage({
  searchParams,
}: {
  searchParams: Promise<ContentListFilters>;
}) {
  await requireAdmin();
  const filters = await searchParams;

  return (
    <AdminPage
      title="Services"
      description="Manage services (services table): publish, feature, reorder, price, estimated duration, add, edit and delete. Feature bullets live in service_features."
      className="mx-auto w-full max-w-6xl"
    >
      <ServicesToolbar filters={filters} />
      <Suspense fallback={<ContentListSkeleton />}>
        <ServicesContent filters={filters} />
      </Suspense>
    </AdminPage>
  );
}
