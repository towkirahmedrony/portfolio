import { Suspense } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import { QueryStateNotice } from "@/components/admin/projects/query-state";
import { PaymentsListTable } from "@/components/admin/payments/payments-list";
import { PaymentsToolbar } from "@/components/admin/payments/payments-toolbar";
import { PaymentsListSkeleton } from "@/components/admin/invoices/invoices-skeleton";
import { getAdminPayments, type PaymentListFilters } from "@/lib/admin-payments";
import { requireAdmin } from "@/lib/require-admin";

async function PaymentsContent({ filters }: { filters: PaymentListFilters }) {
  const result = await getAdminPayments(filters);

  if (result.status === "error" || result.status === "unavailable") {
    return <QueryStateNotice result={result} />;
  }

  if (result.status === "empty") {
    return (
      <QueryStateNotice
        result={result}
        emptyMessage="No payments match the current filters."
      />
    );
  }

  return <PaymentsListTable payments={result.data} />;
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<PaymentListFilters>;
}) {
  await requireAdmin();
  const filters = await searchParams;

  return (
    <AdminPage
      title="Payments"
      description="Ledger of payments table rows. Manual recordings are allowed; no payment gateway is connected."
      className="mx-auto w-full max-w-6xl"
    >
      <PaymentsToolbar filters={filters} />
      <Suspense fallback={<PaymentsListSkeleton />}>
        <PaymentsContent filters={filters} />
      </Suspense>
    </AdminPage>
  );
}
