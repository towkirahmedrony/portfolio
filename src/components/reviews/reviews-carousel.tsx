"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ReviewCard } from "@/components/reviews/review-card";
import { cn } from "@/lib/utils";
import type { PublicReview } from "@/types";

const AUTO_ADVANCE_MS = 5000;

export function ReviewsCarousel({ reviews }: { reviews: PublicReview[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
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

  const scrollByCard = useCallback((direction: -1 | 1, loop = false) => {
    const node = scrollerRef.current;
    if (!node) {
      return;
    }
    const card = node.querySelector<HTMLElement>("[data-review-slide]");
    const amount = card ? card.offsetWidth + 20 : node.clientWidth * 0.85;
    const max = node.scrollWidth - node.clientWidth;
    const atEnd = node.scrollLeft >= max - 8;
    const atStart = node.scrollLeft <= 8;

    if (loop && direction === 1 && atEnd) {
      node.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }
    if (loop && direction === -1 && atStart) {
      node.scrollTo({ left: max, behavior: "smooth" });
      return;
    }

    node.scrollBy({ left: direction * amount, behavior: "smooth" });
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

  useEffect(() => {
    if (reviews.length < 2) {
      return;
    }

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) {
      return;
    }

    const timer = window.setInterval(() => {
      if (pausedRef.current) {
        return;
      }
      scrollByCard(1, true);
    }, AUTO_ADVANCE_MS);

    return () => window.clearInterval(timer);
  }, [reviews.length, scrollByCard]);

  const pause = () => {
    pausedRef.current = true;
  };
  const resume = () => {
    pausedRef.current = false;
  };

  return (
    <div
      className="relative"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocusCapture={pause}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          resume();
        }
      }}
    >
      <div
        ref={scrollerRef}
        className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Client reviews"
        aria-roledescription="carousel"
        onPointerDown={pause}
        onPointerUp={resume}
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
      {reviews.length > 1 ? (
        <div className="mt-6 flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollByCard(-1, true)}
            disabled={!canPrev && !canNext}
            aria-label="Previous reviews"
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-full border border-card-border bg-card text-lg leading-none transition-colors",
              canPrev || canNext
                ? "text-foreground hover:border-foreground/25 hover:bg-accent-soft"
                : "cursor-not-allowed text-muted opacity-40",
            )}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => scrollByCard(1, true)}
            disabled={!canPrev && !canNext}
            aria-label="Next reviews"
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-full border border-card-border bg-card text-lg leading-none transition-colors",
              canPrev || canNext
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
