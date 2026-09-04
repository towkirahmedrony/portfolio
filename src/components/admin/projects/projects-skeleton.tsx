function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-3xl border border-card-border bg-card ${className}`} />;
}

export function ProjectsListSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Pulse className="h-28" />
      <Pulse className="h-80" />
    </div>
  );
}

export function ProjectDetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Pulse className="h-10 w-64" />
      <Pulse className="h-12" />
      <Pulse className="h-80" />
    </div>
  );
}
