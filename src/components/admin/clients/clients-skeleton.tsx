function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-3xl border border-card-border bg-card ${className}`} />;
}

export function ClientsListSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Pulse className="h-28" />
      <Pulse className="h-80" />
    </div>
  );
}

export function ClientDetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Pulse className="h-10 w-72" />
      <Pulse className="h-56" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Pulse className="h-64" />
        <Pulse className="h-64" />
      </div>
      <Pulse className="h-72" />
    </div>
  );
}
