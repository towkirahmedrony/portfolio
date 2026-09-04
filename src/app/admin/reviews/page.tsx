import { Suspense } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import { ContentListSkeleton } from "@/components/admin/content/content-skeletons";
import { ReviewsList } from "@/components/admin/reviews/reviews-list";
import { ReviewsToolbar } from "@/components/admin/reviews/reviews-toolbar";
import { QueryStateNotice } from "@/components/admin/projects/query-state";
import type { ReviewFilters } from "@/lib/admin-review-constants";
import { getAdminReviews } from "@/lib/admin-reviews";
import { requireAdmin } from "@/lib/require-admin";

async function ReviewsContent({ filters }: { filters: ReviewFilters }) {
  const result = await getAdminReviews(filters);

  if (result.status === "error" || result.status === "unavailable") {
    return <QueryStateNotice result={result} />;
  }

  if (result.status === "empty" || result.data.length === 0) {
    const active = filters.status ?? "all";
    return (
      <div className="rounded-3xl border border-dashed border-card-border bg-card p-10 text-center">
        <p className="text-sm text-muted">
          {active === "all"
            ? "No reviews yet. Reviews submitted by clients will appear here for moderation."
            : "No reviews in this state right now."}
        </p>
      </div>
    );
  }

  return <ReviewsList reviews={result.data} />;
}

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<ReviewFilters>;
}) {
  await requireAdmin();
  const filters = await searchParams;
  const current = filters.status ?? "all";

  return (
    <AdminPage
      title="Reviews"
      description="Moderation inbox for client reviews. Approve, reject, hide or publish reviews — review ownership and client/project relationships are never editable from here."
      className="mx-auto w-full max-w-4xl"
    >
      <ReviewsToolbar current={current} />
      <Suspense fallback={<ContentListSkeleton />}>
        <ReviewsContent filters={filters} />
      </Suspense>
    </AdminPage>
  );
}
