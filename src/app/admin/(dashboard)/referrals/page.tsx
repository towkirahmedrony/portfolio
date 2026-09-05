import { Suspense } from "react";
import Link from "next/link";
import { AdminPage } from "@/components/admin/admin-page";
import { ReferralsListTable } from "@/components/admin/referrals/referrals-list";
import { ReferralOverview } from "@/components/admin/referrals/referrals-overview";
import {
  ReferralsEmptyState,
  ReferralsPagination,
} from "@/components/admin/referrals/referrals-pagination";
import { ReferralsListSkeleton } from "@/components/admin/referrals/referrals-skeleton";
import { ReferralsToolbar } from "@/components/admin/referrals/referrals-toolbar";
import { QueryStateNotice } from "@/components/admin/projects/query-state";
import {
  buildReferralsHref,
  type ReferralListFilters,
} from "@/lib/admin-referral-constants";
import {
  getAdminReferrals,
  getReferralOverview,
} from "@/lib/admin-referrals";
import { requireAdmin } from "@/lib/require-admin";

async function ReferralsContent({ filters }: { filters: ReferralListFilters }) {
  const [overview, result] = await Promise.all([
    getReferralOverview(),
    getAdminReferrals(filters),
  ]);

  const hasFilters = Boolean(
    filters.q?.trim() || (filters.status && filters.status !== "all"),
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Link
          href="/admin/referrals/settings"
          className="rounded-xl border border-card-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:border-foreground"
        >
          Program settings
        </Link>
      </div>
      <ReferralOverview overview={overview} />

      <div>
        {result.status === "error" || result.status === "unavailable" ? (
          <QueryStateNotice result={result} />
        ) : result.status === "empty" || result.data.items.length === 0 ? (
          <ReferralsEmptyState
            hasFilters={hasFilters}
            clearHref={buildReferralsHref({})}
          />
        ) : (
          <>
            <ReferralsListTable items={result.data.items} />
            <ReferralsPagination
              filters={filters}
              total={result.data.total}
              page={result.data.page}
              totalPages={result.data.totalPages}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default async function AdminReferralsPage({
  searchParams,
}: {
  searchParams: Promise<ReferralListFilters>;
}) {
  await requireAdmin();
  const filters = await searchParams;

  return (
    <AdminPage
      title="Referrals"
      description="Program overview and referral relationships from the referrals table. Search, filter by status, and open a referral to see its full relationship and reward history."
      className="mx-auto w-full max-w-7xl"
    >
      <ReferralsToolbar filters={filters} />
      <Suspense fallback={<ReferralsListSkeleton />}>
        <ReferralsContent filters={filters} />
      </Suspense>
    </AdminPage>
  );
}
