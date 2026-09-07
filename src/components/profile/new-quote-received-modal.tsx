"use client";

import { useEffect, useRef, useState } from "react";
import { ClientQuoteActions } from "@/components/profile/client-quote-actions";
import { ButtonLink } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatDate } from "@/lib/admin-project-constants";
import { formatClientQuoteStatusLabel } from "@/lib/admin-quote-constants";
import type { CustomerQuoteAlert } from "@/lib/customer-project-requests";
import { markOwnQuoteViewed } from "@/lib/customer-quote-actions";
import { formatMoney } from "@/lib/quote-money";

export function NewQuoteReceivedModal({ alert }: { alert: CustomerQuoteAlert }) {
  const [open, setOpen] = useState(true);
  const markedRef = useRef(false);
  const { quote, projectId, projectTitle, requestId } = alert;
  const currency = quote.currency || "BDT";
  const summary = quote.notes?.trim()
    ? quote.notes.trim().slice(0, 220)
    : "Please review this quote and choose an action.";

  useEffect(() => {
    if (!open || quote.status !== "sent" || markedRef.current) {
      return;
    }
    markedRef.current = true;
    void markOwnQuoteViewed(quote.id);
  }, [open, quote.id, quote.status]);

  if (!open) {
    return null;
  }

  return (
    <Modal
      title="New Quote Received"
      description="Admin has sent you a quote. Please review it and choose an action."
      onClose={() => setOpen(false)}
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-accent/25 bg-accent/5 p-4">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted">Project</p>
          <p className="mt-1 text-base font-medium">{projectTitle}</p>
          <p className="mt-3 text-2xl font-medium tracking-tight">
            {formatMoney(quote.total, currency)}
          </p>
          <p className="mt-1 text-sm text-muted">
            {`Quote v${quote.version} · ${formatClientQuoteStatusLabel(quote.status)}`}
          </p>
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[10px] font-medium uppercase tracking-wider text-muted">Total</dt>
            <dd className="mt-1 font-medium">{formatMoney(quote.total, currency)}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-medium uppercase tracking-wider text-muted">Currency</dt>
            <dd className="mt-1">{currency}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-medium uppercase tracking-wider text-muted">Valid until</dt>
            <dd className="mt-1">{formatDate(quote.valid_until)}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-medium uppercase tracking-wider text-muted">Quote version</dt>
            <dd className="mt-1">{`v${quote.version}`}</dd>
          </div>
        </dl>

        <p className="text-sm leading-6 text-muted">{summary}</p>

        <ClientQuoteActions quote={quote} className="flex flex-wrap gap-2" />

        <ButtonLink
          href={
            projectId
              ? `/profile/projects/${projectId}`
              : `/profile/project-requests/${requestId}`
          }
          variant="secondary"
          className="h-10 w-full px-4 text-xs"
        >
          View Full Quote
        </ButtonLink>
      </div>
    </Modal>
  );
}
