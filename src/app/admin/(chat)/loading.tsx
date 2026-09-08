export default function AdminChatLoading() {
  return (
    <div className="flex h-svh min-h-0 flex-col overflow-hidden bg-card">
      <div className="flex items-center gap-3 border-b border-card-border px-3 py-3 sm:px-4">
        <div className="h-10 w-10 animate-pulse rounded-full bg-card-border" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3 w-28 animate-pulse rounded-full bg-card-border" />
          <div className="h-3 w-44 animate-pulse rounded-full bg-card-border" />
        </div>
        <div className="h-10 w-20 animate-pulse rounded-full bg-card-border" />
      </div>
      <div className="flex-1 space-y-3 px-4 py-4">
        <div className="ml-auto h-10 w-3/4 animate-pulse rounded-2xl bg-card-border" />
        <div className="h-12 w-2/3 animate-pulse rounded-2xl bg-card-border" />
        <div className="ml-auto h-8 w-1/2 animate-pulse rounded-2xl bg-card-border" />
      </div>
      <div className="flex items-center gap-2 border-t border-card-border px-3 py-3">
        <div className="h-12 flex-1 animate-pulse rounded-2xl bg-card-border" />
        <div className="h-12 w-20 animate-pulse rounded-full bg-card-border" />
      </div>
    </div>
  );
}
