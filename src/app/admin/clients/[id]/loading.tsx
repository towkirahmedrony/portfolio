import { AdminPage } from "@/components/admin/admin-page";
import { ClientDetailSkeleton } from "@/components/admin/clients/clients-skeleton";

export default function AdminClientDetailLoading() {
  return (
    <AdminPage
      title="Client"
      description="Loading client from Supabase."
      className="mx-auto w-full max-w-6xl"
    >
      <ClientDetailSkeleton />
    </AdminPage>
  );
}
