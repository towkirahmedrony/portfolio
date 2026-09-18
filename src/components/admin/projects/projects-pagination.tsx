import Link from "next/link";
import {
  buildProjectsHref,
  type ProjectListFilters,
} from "@/lib/admin-project-constants";

export function ProjectsPagination({
  filters,
  total,
  page,
  totalPages,
  pageSize,
}: {
  filters: ProjectListFilters;
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
}) {
  if (filters.view === "kanban" || (totalPages <= 1 && total <= pageSize)) {
    return null;
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const prevHref = buildProjectsHref({ ...filters, page: String(page - 1) });
  const nextHref = buildProjectsHref({ ...filters, page: String(page + 1) });

  return (
    <nav
      aria-label="Project list pagination"
      className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted"
    >
      <p>
        Showing {total === 0 ? 0 : start}–{end} of {total} projects · Page {page} of{" "}
        {totalPages}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={prevHref}
            className="rounded-xl border border-card-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:border-foreground"
          >
            Previous
          </Link>
        ) : null}
        {page < totalPages ? (
          <Link
            href={nextHref}
            className="rounded-xl border border-card-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:border-foreground"
          >
            Next
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
