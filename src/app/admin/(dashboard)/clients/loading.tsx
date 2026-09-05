import { AdminPage } from "@/components/admin/admin-page";
import { ClientsListSkeleton } from "@/components/admin/clients/clients-skeleton";

export default function AdminClientsLoading() {
  return (
    <AdminPage
      title="Clients"
      description="Loading clients from Supabase."
      className="mx-auto w-full max-w-7xl"
    >
      <ClientsListSkeleton />
    </AdminPage>
  );
}
