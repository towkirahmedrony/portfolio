function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-3xl border border-card-border bg-card ${className}`} />;
}

export function ProjectRequestsListSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Pulse className="h-28" />
      <Pulse className="h-80" />
    </div>
  );
}

export function ProjectRequestDetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Pulse className="h-10 w-72" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Pulse className="h-80 lg:col-span-2" />
        <Pulse className="h-80" />
      </div>
      <Pulse className="h-64" />
    </div>
  );
}
