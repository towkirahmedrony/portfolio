import Link from "next/link";
import {
  buildProjectRequestsHref,
  type ProjectRequestListFilters,
} from "@/lib/admin-project-request-constants";

export function ProjectRequestsPagination({
  filters,
  total,
  page,
  totalPages,
  pageSize,
}: {
  filters: ProjectRequestListFilters;
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
}) {
  if (totalPages <= 1 && total <= pageSize) {
    return null;
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const prevHref = buildProjectRequestsHref({ ...filters, page: String(page - 1) });
  const nextHref = buildProjectRequestsHref({ ...filters, page: String(page + 1) });

  return (
    <nav
      aria-label="Project request list pagination"
      className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted"
    >
      <p>
        Showing {total === 0 ? 0 : start}–{end} of {total} requests · Page {page} of{" "}
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
