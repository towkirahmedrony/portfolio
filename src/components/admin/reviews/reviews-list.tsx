import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/admin/projects/action-form";
import { ConfirmSubmitButton } from "@/components/admin/projects/confirm-button";
import { StatusPill } from "@/components/admin/projects/query-state";
import { moderateReview } from "@/lib/admin-review-actions";
import {
  allowedModerationActions,
  formatDate,
  formatDateTime,
  formatReviewStatusLabel,
  getReviewStatusStyle,
  REVIEW_ACTION_LABELS,
  type AdminReviewItem,
  type ReviewModerationAction,
} from "@/lib/admin-review-constants";
import { RatingStars } from "@/components/admin/reviews/rating-stars";

function actionClassName(action: ReviewModerationAction): string {
  switch (action) {
    case "reject":
      return "rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white";
    case "hide":
      return "rounded-xl border border-card-border px-3 py-2 text-sm font-medium text-muted hover:text-foreground";
    case "unhide":
      return "rounded-xl border border-card-border px-3 py-2 text-sm font-medium text-foreground";
    default:
      return "rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background";
  }
}

function actionConfirmation(action: ReviewModerationAction): string | null {
  switch (action) {
    case "reject":
      return "Reject this review? It will no longer be eligible for publication.";
    case "hide":
      return "Hide this review from the public site?";
    default:
      return null;
  }
}

export function ReviewCard({ review }: { review: AdminReviewItem }) {
  const actions = allowedModerationActions(review.status, review.published_at);

  return (
    <article className="rounded-3xl border border-card-border bg-card p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <div>
            <Link
              href={`/admin/clients/${review.client_id}`}
              className="font-medium text-foreground hover:underline"
            >
              {review.clientName}
            </Link>
            {review.clientCompany ? (
              <span className="text-xs text-muted"> · {review.clientCompany}</span>
            ) : null}
          </div>
          <Link
            href={`/admin/projects/${review.project_id}`}
            className="rounded-full border border-card-border px-2.5 py-0.5 text-xs text-muted hover:text-foreground"
          >
            {review.projectNumber}
            {review.projectTitle ? ` · ${review.projectTitle}` : ""}
          </Link>
        </div>
        <StatusPill
          label={formatReviewStatusLabel(review.status)}
          className={getReviewStatusStyle(review.status)}
        />
      </header>

      <div className="mt-3">
        <RatingStars rating={review.rating} />
        {review.title ? (
          <h3 className="mt-2 font-display text-lg text-foreground">{review.title}</h3>
        ) : null}
        <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-muted">
          {review.review}
        </p>
      </div>

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-card-border/60 pt-3">
        <p className="text-xs text-muted">
          Submitted {formatDateTime(review.submitted_at)}
          {review.published_at ? ` · Published ${formatDate(review.published_at)}` : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => {
            const confirm = actionConfirmation(action);
            const label = REVIEW_ACTION_LABELS[action];
            return (
              <ActionForm
                key={action}
                action={moderateReview}
                className="inline-flex"
              >
                <input type="hidden" name="reviewId" value={review.id} />
                <input type="hidden" name="action" value={action} />
                {confirm ? (
                  <ConfirmSubmitButton message={confirm} className={actionClassName(action)}>
                    {label}
                  </ConfirmSubmitButton>
                ) : (
                  <SubmitButton className="px-3 py-1.5 text-xs" pendingLabel="Working…">
                    {label}
                  </SubmitButton>
                )}
              </ActionForm>
            );
          })}
        </div>
      </footer>
    </article>
  );
}

export function ReviewsList({ reviews }: { reviews: AdminReviewItem[] }) {
  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <ReviewCard key={review.id} review={review} />
      ))}
    </div>
  );
}
