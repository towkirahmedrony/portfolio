export default function ProjectRequestDetailsLoading() {
  return (
    <div className="mx-auto max-w-4xl pt-28 pb-12 sm:pt-32 px-5 sm:px-8" aria-busy="true">
      <div className="h-4 w-32 animate-pulse rounded bg-card-border" />
      <div className="mt-8 h-8 w-64 animate-pulse rounded bg-card-border" />
      <div className="mt-4 h-4 w-40 animate-pulse rounded bg-card-border" />
      <div className="mt-10 grid gap-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-card-border bg-card p-6 sm:p-8"
          >
            <div className="h-5 w-40 animate-pulse rounded bg-card-border" />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="h-10 animate-pulse rounded bg-card-border" />
              <div className="h-10 animate-pulse rounded bg-card-border" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
