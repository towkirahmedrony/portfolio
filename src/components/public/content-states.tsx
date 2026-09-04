import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared public UI states for database-driven content: loading skeletons,
 * empty and error/unavailable messages. Messages never expose raw database
 * errors — visitors only ever see friendly, generic copy.
 */

export function ContentStateMessage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "rounded-2xl border border-dashed border-card-border bg-card px-6 py-12 text-center text-sm leading-6 text-muted",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-card-border bg-card">
      <div className="aspect-[3/2] animate-pulse bg-accent-soft" aria-hidden="true" />
      <div className="space-y-3 p-6 sm:p-7">
        <div className="h-3 w-20 animate-pulse rounded bg-card-border" aria-hidden="true" />
        <div className="h-5 w-3/4 animate-pulse rounded bg-card-border" aria-hidden="true" />
        <div className="h-3 w-full animate-pulse rounded bg-card-border" aria-hidden="true" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-card-border" aria-hidden="true" />
        <div className="flex flex-wrap gap-2 pt-2">
          <div className="h-6 w-20 animate-pulse rounded-full bg-card-border" aria-hidden="true" />
          <div className="h-6 w-24 animate-pulse rounded-full bg-card-border" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

export function ProjectGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
      aria-busy="true"
      aria-label="Loading projects"
    >
      {Array.from({ length: count }).map((_, index) => (
        <ProjectCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function ServiceCardSkeleton() {
  return (
    <div className="grid gap-8 rounded-2xl border border-card-border bg-card p-6 sm:p-8 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-4">
        <div className="h-6 w-2/3 animate-pulse rounded bg-card-border" aria-hidden="true" />
        <div className="space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-card-border" aria-hidden="true" />
          <div className="h-3 w-full animate-pulse rounded bg-card-border" aria-hidden="true" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-card-border" aria-hidden="true" />
        </div>
        <div className="h-9 w-40 animate-pulse rounded-full bg-card-border" aria-hidden="true" />
      </div>
      <div className="grid gap-6">
        <div className="space-y-3">
          <div className="h-3 w-24 animate-pulse rounded bg-card-border" aria-hidden="true" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-card-border" aria-hidden="true" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-card-border" aria-hidden="true" />
        </div>
        <div className="space-y-3">
          <div className="h-3 w-28 animate-pulse rounded bg-card-border" aria-hidden="true" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-card-border" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

export function ServiceListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Loading services">
      {Array.from({ length: count }).map((_, index) => (
        <ServiceCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function HomeCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
      aria-busy="true"
      aria-label="Loading content"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="space-y-3 rounded-2xl border border-card-border bg-card p-6 sm:p-8">
          <div className="h-5 w-2/3 animate-pulse rounded bg-card-border" aria-hidden="true" />
          <div className="h-3 w-full animate-pulse rounded bg-card-border" aria-hidden="true" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-card-border" aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}
