import { Suspense } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import { QueryStateNotice } from "@/components/admin/projects/query-state";
import { PaymentEventsListTable } from "@/components/admin/payments/payment-events-list";
import { PaymentEventsToolbar } from "@/components/admin/payments/payment-events-toolbar";
import { PaymentsListSkeleton } from "@/components/admin/invoices/invoices-skeleton";
import { getAdminPaymentEvents } from "@/lib/admin-payments";
import type { PaymentEventListFilters } from "@/lib/admin-invoice-constants";
import { requireAdmin } from "@/lib/require-admin";

async function PaymentEventsContent({ filters }: { filters: PaymentEventListFilters }) {
  const result = await getAdminPaymentEvents(filters);

  if (result.status === "error" || result.status === "unavailable") {
    return <QueryStateNotice result={result} />;
  }

  if (result.status === "empty") {
    return (
      <QueryStateNotice
        result={result}
        emptyMessage="No payment events match the current filters. Events appear only when a gateway webhook is processed."
      />
    );
  }

  return <PaymentEventsListTable events={result.data} />;
}

export default async function AdminPaymentEventsPage({
  searchParams,
}: {
  searchParams: Promise<PaymentEventListFilters>;
}) {
  await requireAdmin();
  const filters = await searchParams;

  return (
    <AdminPage
      title="Payment events"
      description="Technical view of payment_events. This is a debug log, not a payment gateway."
      className="mx-auto w-full max-w-6xl"
    >
      <PaymentEventsToolbar filters={filters} />
      <Suspense fallback={<PaymentsListSkeleton />}>
        <PaymentEventsContent filters={filters} />
      </Suspense>
    </AdminPage>
  );
}
