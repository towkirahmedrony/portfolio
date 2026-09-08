// Instant shell for the Admin Messages hub.
export default function AdminMessagesLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 sm:px-8">
      <div className="h-8 w-56 animate-pulse rounded-xl bg-card-border" />
      <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded-full bg-card-border" />
      <div className="mt-8 grid gap-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-2xl border border-card-border bg-card p-5"
          />
        ))}
      </div>
    </div>
  );
}
