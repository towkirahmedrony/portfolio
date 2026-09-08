// Instant app-like chat shell — renders immediately, conversation streams in.
export default function ProjectMessagesLoading() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col px-2 pt-[4.25rem] pb-0 sm:px-8 sm:pt-28 sm:pb-10">
      <div className="mb-4 hidden items-end justify-between gap-3 sm:flex">
        <div>
          <div className="h-3 w-24 animate-pulse rounded-full bg-accent/15" />
          <div className="mt-2 h-8 w-64 animate-pulse rounded-xl bg-card-border" />
        </div>
      </div>
      <div className="flex h-[calc(100dvh_-_4.5rem)] min-h-[22rem] animate-pulse flex-col overflow-hidden rounded-2xl border border-card-border bg-card sm:h-[min(76vh,44rem)] sm:min-h-[30rem] sm:rounded-3xl">
        <div className="flex items-center gap-3 border-b border-card-border px-4 py-3">
          <div className="h-10 w-10 rounded-full bg-card-border" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-28 rounded-full bg-card-border" />
            <div className="h-3 w-44 rounded-full bg-card-border" />
          </div>
          <div className="h-8 w-20 rounded-full bg-card-border" />
        </div>
        <div className="flex-1 space-y-3 px-4 py-4">
          <div className="ml-auto h-10 w-3/4 rounded-2xl bg-card-border" />
          <div className="h-12 w-2/3 rounded-2xl bg-card-border" />
          <div className="ml-auto h-8 w-1/2 rounded-2xl bg-card-border" />
        </div>
        <div className="flex items-center gap-2 border-t border-card-border px-3 py-3">
          <div className="h-12 flex-1 rounded-2xl bg-card-border" />
          <div className="h-12 w-20 rounded-full bg-card-border" />
        </div>
      </div>
    </div>
  );
}
