import { formatDateTime } from "@/lib/admin-projects";
import { StatusPill } from "@/components/admin/projects/query-state";
import type { PaymentEventRow } from "@/types/database";

function payloadPreview(payload: PaymentEventRow["payload"]): string {
  try {
    const text = JSON.stringify(payload);
    if (!text) {
      return "—";
    }
    return text.length > 120 ? `${text.slice(0, 117)}…` : text;
  } catch {
    return "—";
  }
}

export function PaymentEventsListTable({ events }: { events: PaymentEventRow[] }) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-card-border bg-card">
      <table className="w-full min-w-[72rem] text-left text-sm">
        <thead className="border-b border-card-border text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3">Provider</th>
            <th className="px-4 py-3">Event ID</th>
            <th className="px-4 py-3">Event type</th>
            <th className="px-4 py-3">Processed</th>
            <th className="px-4 py-3">Error message</th>
            <th className="px-4 py-3">Created</th>
            <th className="px-4 py-3">Processed at</th>
            <th className="px-4 py-3">Payload</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id} className="border-b border-card-border/60 last:border-0 hover:bg-foreground/[0.02]">
              <td className="px-4 py-3 font-medium text-foreground">{event.provider}</td>
              <td className="px-4 py-3 font-mono text-xs text-foreground">{event.event_id}</td>
              <td className="px-4 py-3 text-foreground">{event.event_type}</td>
              <td className="px-4 py-3">
                <StatusPill
                  label={event.processed ? "Processed" : "Pending"}
                  className={
                    event.processed
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  }
                />
              </td>
              <td className="px-4 py-3 text-muted">{event.error_message || "—"}</td>
              <td className="px-4 py-3 text-muted">{formatDateTime(event.created_at)}</td>
              <td className="px-4 py-3 text-muted">{formatDateTime(event.processed_at)}</td>
              <td className="px-4 py-3 font-mono text-xs text-muted">{payloadPreview(event.payload)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
