import { Suspense } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import { AuditLogList } from "@/components/admin/audit-logs/audit-log-list";
import { AuditToolbar } from "@/components/admin/audit-logs/audit-toolbar";
import { ContentListSkeleton } from "@/components/admin/content/content-skeletons";
import { QueryStateNotice } from "@/components/admin/projects/query-state";
import {
  AUDIT_LOG_PAGE_SIZE,
  buildAuditHref,
  type AuditLogFilters,
} from "@/lib/admin-audit-constants";
import { getAuditFacets, getAuditLogs } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/require-admin";
import Link from "next/link";

async function AuditContent({ filters }: { filters: AuditLogFilters }) {
  const result = await getAuditLogs(filters);

  if (result.status === "error" || result.status === "unavailable") {
    return <QueryStateNotice result={result} />;
  }

  if (result.status === "empty" || result.data.items.length === 0) {
    const hasFilters = Object.values(filters).some((value) => Boolean(value));
    return (
      <div className="rounded-3xl border border-dashed border-card-border bg-card p-10 text-center">
        <p className="text-sm text-muted">
          {hasFilters
            ? "No audit entries match the current filters."
            : "No audit entries yet. System actions will be recorded here."}
        </p>
        {hasFilters ? (
          <Link
            href="/admin/audit-logs"
            className="mt-3 inline-block rounded-xl border border-card-border px-3 py-2 text-sm font-medium text-foreground hover:border-foreground"
          >
            Reset filters
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <AuditLogList logs={result.data.items} />
      <AuditPagination filters={filters} data={result.data} />
    </>
  );
}

function AuditPagination({
  filters,
  data,
}: {
  filters: AuditLogFilters;
  data: { total: number; page: number; totalPages: number };
}) {
  if (data.totalPages <= 1) {
    return null;
  }
  const start = (data.page - 1) * AUDIT_LOG_PAGE_SIZE + 1;
  const end = Math.min(data.page * AUDIT_LOG_PAGE_SIZE, data.total);
  return (
    <nav
      aria-label="Audit log pagination"
      className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted"
    >
      <p>
        Showing {start}–{end} of {data.total} entries · Page {data.page} of{" "}
        {data.totalPages}
      </p>
      <div className="flex gap-2">
        {data.page > 1 ? (
          <Link
            href={buildAuditHref({ ...filters, page: String(data.page - 1) })}
            className="rounded-xl border border-card-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:border-foreground"
          >
            Previous
          </Link>
        ) : null}
        {data.page < data.totalPages ? (
          <Link
            href={buildAuditHref({ ...filters, page: String(data.page + 1) })}
            className="rounded-xl border border-card-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:border-foreground"
          >
            Next
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<AuditLogFilters>;
}) {
  await requireAdmin();
  const filters = await searchParams;

  const [facets] = await Promise.all([getAuditFacets()]);
  const facetsAvailable =
    facets.actors.status === "ok" &&
    facets.actions.status === "ok" &&
    facets.entities.status === "ok";

  return (
    <AdminPage
      title="Audit Logs"
      description="Read-only history of system actions for troubleshooting. Entries can be searched, filtered by actor/action/entity and date range, and expanded for structured details."
      className="mx-auto w-full max-w-6xl"
    >
      <AuditToolbar
        filters={filters}
        actors={facets.actors.status === "ok" ? facets.actors.data : []}
        actions={facets.actions.status === "ok" ? facets.actions.data : []}
        entities={facets.entities.status === "ok" ? facets.entities.data : []}
      />
      {!facetsAvailable ? (
        <p className="mb-4 text-xs text-muted">
          Filter options are unavailable right now — table still works below.
        </p>
      ) : null}
      <Suspense fallback={<ContentListSkeleton />}>
        <AuditContent filters={filters} />
      </Suspense>
    </AdminPage>
  );
}
