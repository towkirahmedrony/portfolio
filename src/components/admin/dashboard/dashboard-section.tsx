import Link from "next/link";
import type { ReactNode } from "react";

export function DashboardChevron({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M9 5.5 15.5 12 9 18.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DashboardSection({
  title,
  description,
  href,
  actionLabel = "View all",
  children,
}: {
  title: string;
  description: string;
  href?: string;
  actionLabel?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <h3 className="font-display text-xl tracking-tight">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
        </div>
        {href ? (
          <Link
            href={href}
            aria-label={`${actionLabel} ${title}`}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 self-start rounded-xl border border-card-border bg-card px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:border-foreground/30 hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {actionLabel}
            <DashboardChevron />
          </Link>
        ) : null}
      </header>
      {children}
    </section>
  );
}
