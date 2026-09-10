import type { PublicReview } from "@/types";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "C";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function Rating({ rating }: { rating: number }) {
  return (
    <div
      className="flex items-center gap-0.5"
      role="img"
      aria-label={`Rated ${rating} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((index) => (
        <span
          key={index}
          aria-hidden="true"
          className={cn(
            "text-sm leading-none",
            index <= rating ? "text-accent" : "text-foreground/15",
          )}
        >
          ★
        </span>
      ))}
    </div>
  );
}

export function ReviewCard({
  review,
  compact = false,
}: {
  review: PublicReview;
  compact?: boolean;
}) {
  const byline = [review.clientName, review.clientCompany]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      className={cn(
        "flex h-full min-w-0 flex-col rounded-2xl border border-card-border bg-card p-6 sm:p-7",
        compact && "p-5 sm:p-6",
      )}
    >
      <Rating rating={review.rating} />
      {review.title ? (
        <h3 className="font-display mt-4 text-lg tracking-tight text-balance">
          {review.title}
        </h3>
      ) : null}
      <blockquote
        className={cn(
          "mt-3 text-sm leading-7 text-muted",
          !review.title && "mt-4",
        )}
      >
        {review.review}
      </blockquote>
      <footer className="mt-auto flex items-center gap-3 pt-6">
        {review.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={review.photo}
            alt=""
            className="h-11 w-11 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-medium tracking-wide text-accent"
          >
            {initials(review.clientName)}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{byline}</p>
          {review.projectTitle ? (
            <p className="mt-0.5 truncate text-xs text-muted">
              {review.projectTitle}
            </p>
          ) : null}
        </div>
      </footer>
    </article>
  );
}
