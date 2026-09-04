import { Suspense } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import { QueryStateNotice } from "@/components/admin/projects/query-state";
import { InvoicesListTable } from "@/components/admin/invoices/invoices-list";
import { InvoicesListSkeleton } from "@/components/admin/invoices/invoices-skeleton";
import { InvoicesToolbar } from "@/components/admin/invoices/invoices-toolbar";
import { getAdminInvoices, type InvoiceListFilters } from "@/lib/admin-invoices";
import { requireAdmin } from "@/lib/require-admin";

async function InvoicesContent({ filters }: { filters: InvoiceListFilters }) {
  const result = await getAdminInvoices(filters);

  if (result.status === "error" || result.status === "unavailable") {
    return <QueryStateNotice result={result} />;
  }

  if (result.status === "empty") {
    return (
      <QueryStateNotice
        result={result}
        emptyMessage="No invoices match the current filter."
      />
    );
  }

  return <InvoicesListTable invoices={result.data} />;
}

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<InvoiceListFilters>;
}) {
  await requireAdmin();
  const filters = await searchParams;

  return (
    <AdminPage
      title="Invoices"
      description="Issue invoices from accepted quotes, track amounts due, and record manual payments."
      className="mx-auto w-full max-w-6xl"
    >
      <InvoicesToolbar filters={filters} />
      <Suspense fallback={<InvoicesListSkeleton />}>
        <InvoicesContent filters={filters} />
      </Suspense>
    </AdminPage>
  );
}
