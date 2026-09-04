function PulseCard({ className }: { className: string }) {
  return (
    <div className={`animate-pulse rounded-3xl border border-card-border bg-card ${className}`} />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-10" aria-busy="true" aria-live="polite">
      <section>
        <div className="mb-4 h-7 w-48 rounded-full bg-card-border/80" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <PulseCard className="h-36" />
          <PulseCard className="h-36" />
          <PulseCard className="h-36" />
          <PulseCard className="h-36" />
        </div>
      </section>
      <section>
        <div className="mb-4 h-7 w-40 rounded-full bg-card-border/80" />
        <div className="grid gap-4 sm:grid-cols-2">
          <PulseCard className="h-28" />
          <PulseCard className="h-28" />
          <PulseCard className="h-28" />
          <PulseCard className="h-28" />
        </div>
      </section>
      <section>
        <div className="mb-4 h-7 w-44 rounded-full bg-card-border/80" />
        <PulseCard className="h-64" />
      </section>
    </div>
  );
}
