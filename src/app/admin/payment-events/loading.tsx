import { AdminPage } from "@/components/admin/admin-page";
import { PaymentsListSkeleton } from "@/components/admin/invoices/invoices-skeleton";

export default function AdminPaymentEventsLoading() {
  return (
    <AdminPage
      title="Payment events"
      description="Loading payment events from Supabase."
      className="mx-auto w-full max-w-6xl"
    >
      <PaymentsListSkeleton />
    </AdminPage>
  );
}
