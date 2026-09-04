import type { ReactNode } from "react";

export function AdminPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-8 max-w-2xl">
        <h2 className="font-display text-2xl tracking-tight sm:text-3xl">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-7 text-muted sm:text-base">
          {description}
        </p>
      </header>
      {children}
    </div>
  );
}

export function AdminPlaceholderCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="rounded-3xl border border-card-border bg-card p-6 sm:p-8">
      <p className="text-xs font-medium tracking-[0.18em] text-accent uppercase">
        Coming later
      </p>
      <h3 className="font-display mt-3 text-xl tracking-tight">{title}</h3>
      <p className="mt-3 max-w-xl text-sm leading-7 text-muted">{description}</p>
    </section>
  );
}
