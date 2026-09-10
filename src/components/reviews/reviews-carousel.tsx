"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ReviewCard } from "@/components/reviews/review-card";
import { cn } from "@/lib/utils";
import type { PublicReview } from "@/types";

export function ReviewsCarousel({ reviews }: { reviews: PublicReview[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const update = useCallback(() => {
    const node = scrollerRef.current;
    if (!node) {
      return;
    }
    const max = node.scrollWidth - node.clientWidth;
    setCanPrev(node.scrollLeft > 8);
    setCanNext(node.scrollLeft < max - 8);
  }, []);

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) {
      return;
    }
    update();
    node.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      node.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [update, reviews.length]);

  const scrollByCard = (direction: -1 | 1) => {
    const node = scrollerRef.current;
    if (!node) {
      return;
    }
    const card = node.querySelector<HTMLElement>("[data-review-slide]");
    const amount = card ? card.offsetWidth + 20 : node.clientWidth * 0.85;
    node.scrollBy({ left: direction * amount, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Client reviews"
      >
        {reviews.map((review) => (
          <div
            key={review.id}
            data-review-slide
            className="w-[min(100%,20.5rem)] shrink-0 snap-start sm:w-[min(100%,24rem)]"
          >
            <ReviewCard review={review} />
          </div>
        ))}
      </div>
      {canPrev || canNext ? (
        <div className="mt-6 flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollByCard(-1)}
            disabled={!canPrev}
            aria-label="Previous reviews"
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-full border border-card-border bg-card text-lg leading-none transition-colors",
              canPrev
                ? "text-foreground hover:border-foreground/25 hover:bg-accent-soft"
                : "cursor-not-allowed text-muted opacity-40",
            )}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => scrollByCard(1)}
            disabled={!canNext}
            aria-label="Next reviews"
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-full border border-card-border bg-card text-lg leading-none transition-colors",
              canNext
                ? "text-foreground hover:border-foreground/25 hover:bg-accent-soft"
                : "cursor-not-allowed text-muted opacity-40",
            )}
          >
            ›
          </button>
        </div>
      ) : null}
    </div>
  );
}
