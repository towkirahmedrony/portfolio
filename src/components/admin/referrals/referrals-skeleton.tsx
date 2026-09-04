function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-3xl border border-card-border bg-card ${className}`} />;
}

export function ReferralsListSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Pulse className="h-36" />
        <Pulse className="h-36" />
        <Pulse className="h-36" />
      </div>
      <Pulse className="h-28" />
      <Pulse className="h-80" />
    </div>
  );
}

export function ReferralDetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Pulse className="h-10 w-72" />
      <Pulse className="h-56" />
      <Pulse className="h-72" />
    </div>
  );
}

export function ReferralSettingsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Pulse className="h-10 w-72" />
      <Pulse className="h-96" />
    </div>
  );
}
