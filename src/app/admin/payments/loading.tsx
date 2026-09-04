import { AdminPage } from "@/components/admin/admin-page";
import { PaymentsListSkeleton } from "@/components/admin/invoices/invoices-skeleton";

export default function AdminPaymentsLoading() {
  return (
    <AdminPage
      title="Payments"
      description="Loading payments from Supabase."
      className="mx-auto w-full max-w-6xl"
    >
      <PaymentsListSkeleton />
    </AdminPage>
  );
}
