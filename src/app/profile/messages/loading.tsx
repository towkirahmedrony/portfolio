// Instant, focused shell for the Messages hub while conversations stream in.
export default function ProfileMessagesLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-24 pb-12 sm:px-8 sm:pt-28">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="h-3 w-20 animate-pulse rounded-full bg-accent/15" />
          <div className="mt-2 h-8 w-56 animate-pulse rounded-xl bg-card-border" />
        </div>
        <div className="h-4 w-32 animate-pulse rounded-full bg-card-border" />
      </div>
      <div className="grid gap-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-2xl border border-card-border bg-card p-5"
          />
        ))}
      </div>
    </div>
  );
}
