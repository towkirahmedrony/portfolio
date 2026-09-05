import { Suspense } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import { ClientsListTable } from "@/components/admin/clients/clients-list";
import {
  ClientsEmptyState,
  ClientsPagination,
} from "@/components/admin/clients/clients-pagination";
import { ClientsListSkeleton } from "@/components/admin/clients/clients-skeleton";
import { ClientsToolbar } from "@/components/admin/clients/clients-toolbar";
import { QueryStateNotice } from "@/components/admin/projects/query-state";
import {
  buildClientsHref,
  type ClientListFilters,
} from "@/lib/admin-client-constants";
import { getAdminClients } from "@/lib/admin-clients";
import { requireAdmin } from "@/lib/require-admin";

async function ClientsContent({ filters }: { filters: ClientListFilters }) {
  const result = await getAdminClients(filters);

  if (result.status === "error" || result.status === "unavailable") {
    return <QueryStateNotice result={result} />;
  }

  const hasFilters = Boolean(
    filters.q?.trim() || (filters.status && filters.status !== "all"),
  );

  if (result.status === "empty" || result.data.items.length === 0) {
    return (
      <ClientsEmptyState
        hasFilters={hasFilters}
        clearHref={buildClientsHref({})}
      />
    );
  }

  return (
    <>
      {!result.data.emailsAvailable ? (
        <p className="mb-3 text-xs text-muted">
          Email addresses are unavailable — apply the admin_auth_emails
          database function (migration) to display them.
        </p>
      ) : null}
      <ClientsListTable data={result.data} />
      <ClientsPagination
        filters={filters}
        total={result.data.total}
        page={result.data.page}
        totalPages={result.data.totalPages}
        pageSize={result.data.pageSize}
      />
    </>
  );
}

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<ClientListFilters>;
}) {
  await requireAdmin();
  const filters = await searchParams;

  return (
    <AdminPage
      title="Clients"
      description="Manage client accounts from the profiles table (role = client): search, filter by status, and open a client to manage their account and related activity."
      className="mx-auto w-full max-w-7xl"
    >
      <ClientsToolbar filters={filters} />
      <Suspense fallback={<ClientsListSkeleton />}>
        <ClientsContent filters={filters} />
      </Suspense>
    </AdminPage>
  );
}
