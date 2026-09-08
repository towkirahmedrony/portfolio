import Link from "next/link";
import { formatMoney } from "@/lib/admin-dashboard";
import { formatDateTime } from "@/lib/admin-projects";
import { isQuoteChangeRequestPending } from "@/lib/admin-quote-responses";
import {
  formatQuoteStatusLabel,
  getQuoteStatusStyle,
} from "@/lib/admin-quote-constants";
import { AdminPanel, StatusPill } from "@/components/admin/projects/query-state";
import type { QuoteRow } from "@/types/database";

function ChangeRequestMark({
  quote,
  siblings,
}: {
  quote: QuoteRow;
  siblings: QuoteRow[];
}) {
  if (!quote.client_change_requested_at) {
    return null;
  }
  const open = isQuoteChangeRequestPending(
    {
      status: quote.status,
      createdAt: quote.client_change_requested_at ?? quote.created_at,
    },
    siblings
      .filter((version) => version.id !== quote.id)
      .map((version) => ({ status: version.status, createdAt: version.created_at })),
  );

  return open ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
      Client requested changes
    </span>
  ) : (
    <span className="rounded-full border border-card-border px-2.5 py-0.5 text-xs text-muted">
      Change request answered
    </span>
  );
}

export function QuoteVersionHistory({
  versions,
  currentId,
}: {
  versions: QuoteRow[];
  currentId: string;
}) {
  return (
    <AdminPanel
      title="Version history"
      description="Each version is stored separately. Previous quotes are never overwritten."
    >
      {versions.length === 0 ? (
        <p className="text-sm text-muted">No versions yet.</p>
      ) : (
        <ol className="space-y-3">
          {versions.map((version) => {
            const current = version.id === currentId;
            return (
              <li key={version.id}>
                <Link
                  href={`/admin/quotes/${version.id}`}
                  className={`block rounded-2xl border px-4 py-3 ${
                    current
                      ? "border-foreground bg-foreground/[0.04]"
                      : "border-card-border bg-background hover:border-foreground/20"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-foreground">
                      Version {version.version}
                      {current ? " · current" : ""}
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      <ChangeRequestMark quote={version} siblings={versions} />
                      <StatusPill
                        label={formatQuoteStatusLabel(version.status)}
                        className={getQuoteStatusStyle(version.status)}
                      />
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                    <span>{formatMoney(Number(version.total), version.currency || "BDT")}</span>
                    <span>Created {formatDateTime(version.created_at)}</span>
                    {version.sent_at ? <span>Sent {formatDateTime(version.sent_at)}</span> : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </AdminPanel>
  );
}
