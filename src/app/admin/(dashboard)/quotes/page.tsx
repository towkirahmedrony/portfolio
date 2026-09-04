import { Suspense } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import { QueryStateNotice } from "@/components/admin/projects/query-state";
import { QuotesListTable } from "@/components/admin/quotes/quotes-list";
import { QuotesListSkeleton } from "@/components/admin/quotes/quotes-skeleton";
import { QuotesToolbar } from "@/components/admin/quotes/quotes-toolbar";
import { getAdminQuotes, type QuoteListFilters } from "@/lib/admin-quotes";
import { requireAdmin } from "@/lib/require-admin";

async function QuotesContent({ filters }: { filters: QuoteListFilters }) {
  const result = await getAdminQuotes(filters);

  if (result.status === "error" || result.status === "unavailable") {
    return <QueryStateNotice result={result} />;
  }

  if (result.status === "empty") {
    return (
      <QueryStateNotice
        result={result}
        emptyMessage="No quotes match the current filter."
      />
    );
  }

  return <QuotesListTable quotes={result.data} />;
}

export default async function AdminQuotesPage({
  searchParams,
}: {
  searchParams: Promise<QuoteListFilters>;
}) {
  await requireAdmin();
  const filters = await searchParams;

  return (
    <AdminPage
      title="Quotes"
      description="Create, version, and send project quotes. Totals are calculated from quote_items."
      className="mx-auto w-full max-w-6xl"
    >
      <QuotesToolbar filters={filters} />
      <Suspense fallback={<QuotesListSkeleton />}>
        <QuotesContent filters={filters} />
      </Suspense>
    </AdminPage>
  );
}
