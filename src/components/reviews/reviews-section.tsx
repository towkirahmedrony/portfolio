import { Suspense } from "react";
import { ReviewCard } from "@/components/reviews/review-card";
import { ReviewsCarousel } from "@/components/reviews/reviews-carousel";
import { Section } from "@/components/ui/section";
import {
  getPublicReviews,
  HOME_REVIEWS_LIMIT,
  SERVICES_REVIEWS_LIMIT,
} from "@/lib/public-content";
import type { PublicReview } from "@/types";

function ReviewsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
      aria-busy="true"
      aria-label="Loading reviews"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="space-y-4 rounded-2xl border border-card-border bg-card p-6 sm:p-7"
        >
          <div className="h-3 w-24 animate-pulse rounded bg-card-border" />
          <div className="h-3 w-full animate-pulse rounded bg-card-border" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-card-border" />
          <div className="mt-6 flex items-center gap-3">
            <div className="h-11 w-11 animate-pulse rounded-full bg-card-border" />
            <div className="h-3 w-32 animate-pulse rounded bg-card-border" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ReviewsLayout({
  reviews,
  compact,
}: {
  reviews: PublicReview[];
  compact: boolean;
}) {
  if (compact) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {reviews.map((review) => (
          <ReviewCard key={review.id} review={review} compact />
        ))}
      </div>
    );
  }

  if (reviews.length > 3) {
    return <ReviewsCarousel reviews={reviews} />;
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {reviews.map((review) => (
        <ReviewCard key={review.id} review={review} />
      ))}
    </div>
  );
}

async function ReviewsContent({ compact }: { compact: boolean }) {
  const result = await getPublicReviews({
    limit: compact ? SERVICES_REVIEWS_LIMIT : HOME_REVIEWS_LIMIT,
  });

  if (result.status !== "ok" || result.data.length === 0) {
    return null;
  }

  return (
    <Section
      id={compact ? "client-notes" : "reviews"}
      eyebrow="Client reviews"
      title="What clients say"
      description={
        compact
          ? "A few notes from people I have already built with."
          : "Feedback from people I have already built websites and web applications with."
      }
    >
      <ReviewsLayout reviews={result.data} compact={compact} />
    </Section>
  );
}

function ReviewsSectionFallback() {
  return (
    <section className="py-16 sm:py-20 lg:py-24" aria-busy="true">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <ReviewsSkeleton />
      </div>
    </section>
  );
}

export function PublicReviewsSection({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <Suspense fallback={<ReviewsSectionFallback />}>
      <ReviewsContent compact={compact} />
    </Suspense>
  );
}
