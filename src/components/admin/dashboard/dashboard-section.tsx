import type { ReactNode } from "react";

export function DashboardSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section>
      <header className="mb-4 max-w-2xl">
        <h3 className="font-display text-xl tracking-tight">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
      </header>
      {children}
    </section>
  );
}
