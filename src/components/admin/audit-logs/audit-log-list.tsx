import {
  auditJsonSummary,
  formatAuditJson,
  formatDateTime,
  type AdminAuditLogItem,
} from "@/lib/admin-audit-constants";

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  const rendered = formatAuditJson(value);
  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-muted">
        {label}
      </p>
      {rendered === "—" ? (
        <p className="rounded-xl bg-background px-3 py-2 text-xs text-muted">No data stored</p>
      ) : (
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-background px-3 py-2 font-mono text-xs leading-relaxed text-foreground">
          {rendered}
        </pre>
      )}
    </div>
  );
}

export function AuditLogList({ logs }: { logs: AdminAuditLogItem[] }) {
  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <details
          key={log.id}
          className="group rounded-2xl border border-card-border bg-card open:border-foreground/30"
        >
          <summary className="grid cursor-pointer list-none gap-x-4 gap-y-1 px-4 py-3 text-sm sm:grid-cols-[11rem_minmax(0,1fr)_auto_auto] [&::-webkit-details-marker]:hidden">
            <span className="font-mono text-xs text-muted">
              {formatDateTime(log.created_at)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-foreground">
                {log.actorName ?? (
                  <span className="italic text-muted">system / unknown</span>
                )}
              </span>
              <span className="block truncate font-mono text-xs text-muted">
                {log.action}
              </span>
            </span>
            <span className="rounded-full border border-card-border px-2 py-0.5 text-xs text-muted">
              {log.entity_type}
            </span>
            <span className="flex items-center gap-2 text-xs text-muted">
              <span className="hidden sm:inline">entity</span>
              <span className="font-mono">{log.entity_id?.slice(0, 8) ?? "—"}</span>
            </span>
            <span className="col-span-full flex min-w-0 gap-4 truncate font-mono text-[11px] text-muted">
              <span className="truncate">
                <span className="mr-1 font-sans">old:</span>
                {auditJsonSummary(log.old_data)}
              </span>
              <span className="truncate">
                <span className="mr-1 font-sans">new:</span>
                {auditJsonSummary(log.new_data)}
              </span>
            </span>
          </summary>

          <div className="border-t border-card-border/60 px-4 py-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-card-border/60 bg-background px-3 py-2 text-xs">
                <span className="text-muted">Entity id:</span>{" "}
                <span className="font-mono break-all text-foreground">
                  {log.entity_id ?? "—"}
                </span>
              </div>
              <div className="rounded-xl border border-card-border/60 bg-background px-3 py-2 text-xs">
                <span className="text-muted">Actor id:</span>{" "}
                <span className="font-mono break-all text-foreground">
                  {log.actor_id ?? "—"}
                </span>
              </div>
              {log.ip_address ? (
                <div className="rounded-xl border border-card-border/60 bg-background px-3 py-2 text-xs">
                  <span className="text-muted">IP:</span>{" "}
                  <span className="font-mono text-foreground">{String(log.ip_address)}</span>
                </div>
              ) : null}
              {log.user_agent ? (
                <div className="rounded-xl border border-card-border/60 bg-background px-3 py-2 text-xs">
                  <span className="text-muted">User agent:</span>{" "}
                  <span className="break-words text-foreground">{log.user_agent}</span>
                </div>
              ) : null}
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <JsonBlock label="Old data" value={log.old_data} />
              <JsonBlock label="New data" value={log.new_data} />
            </div>

            <p className="mt-3 text-[11px] leading-4 text-muted">
              Read-only entry · secret-looking keys in JSON payloads are redacted
              automatically.
            </p>
          </div>
        </details>
      ))}
    </div>
  );
}
