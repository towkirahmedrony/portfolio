import type { ReactNode } from "react";

export function AdminPage({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={className ?? "mx-auto w-full max-w-5xl"}>
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
    <section className="rounded-3xl border border-card-border bg-card p-6 flex flex-col justify-center h-full">
      <h3 className="font-display text-xl tracking-tight text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
    </section>
  );
}
