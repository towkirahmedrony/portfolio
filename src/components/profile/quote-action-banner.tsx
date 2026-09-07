import { ClientQuoteActions } from "@/components/profile/client-quote-actions";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/admin-project-constants";
import {
  formatClientQuoteStatusLabel,
  getQuoteStatusStyle,
} from "@/lib/admin-quote-constants";
import type { CustomerQuoteAlert } from "@/lib/customer-project-requests";
import { formatMoney } from "@/lib/quote-money";

export function QuoteActionBanner({ alerts }: { alerts: CustomerQuoteAlert[] }) {
  if (alerts.length === 0) {
    return null;
  }

  return (
    <Card className="hover:translate-y-0 border-accent/30 bg-accent/5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            New Quote Received
          </p>
          <h3 className="font-display mt-1 text-xl tracking-tight">
            {alerts.length === 1
              ? "Admin has sent you a quote"
              : "Admin has sent you quotes that need a response"}
          </h3>
          <p className="mt-1 text-sm text-muted">
            Review the quoted amount and accept, reject, or request changes without searching for project details.
          </p>
        </div>
        <Badge>{`${alerts.length} awaiting you`}</Badge>
      </div>

      <div className="mt-6 grid gap-4">
        {alerts.map((alert) => (
          <div
            key={alert.quote.id}
            className="flex flex-col gap-4 rounded-xl border border-card-border bg-background p-5 lg:flex-row lg:items-center lg:justify-between"
          >
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge className={getQuoteStatusStyle(alert.quote.status)}>
                  {`Quote: ${formatClientQuoteStatusLabel(alert.quote.status)}`}
                </Badge>
                <span className="text-xs text-muted">{`v${alert.quote.version}`}</span>
              </div>
              <h4 className="font-display text-lg font-medium tracking-tight">{alert.projectTitle}</h4>
              <p className="mt-1 text-sm text-muted">
                {`Valid until ${formatDate(alert.quote.valid_until)}`}
              </p>
            </div>
            <div className="flex flex-col gap-3 lg:items-end">
              <p className="text-xl font-medium">
                {formatMoney(alert.quote.total, alert.quote.currency)}
              </p>
              <ClientQuoteActions quote={alert.quote} className="flex flex-wrap gap-2" />
              <ButtonLink
                href={
                  alert.projectId
                    ? `/profile/projects/${alert.projectId}`
                    : `/profile/project-requests/${alert.requestId}`
                }
                variant="secondary"
                className="h-10 px-4 text-xs"
              >
                View Full Quote
              </ButtonLink>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
