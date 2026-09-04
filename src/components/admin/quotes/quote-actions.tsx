import { ActionForm, SubmitButton } from "@/components/admin/projects/action-form";
import { AdminPanel } from "@/components/admin/projects/query-state";
import {
  canCreateQuoteVersion,
  canSendQuote,
  formatQuoteStatusLabel,
  getAllowedQuoteTransitions,
} from "@/lib/admin-quote-constants";
import {
  createQuoteVersion,
  sendQuoteToClient,
  updateQuoteStatus,
} from "@/lib/admin-quote-actions";
import { isQuotePdfExportSupported } from "@/lib/quote-pdf";
import type { QuoteRow } from "@/types/database";

export function QuoteActions({ quote }: { quote: QuoteRow }) {
  const transitions = getAllowedQuoteTransitions(quote.status);
  const pdfReady = isQuotePdfExportSupported();

  return (
    <div className="grid gap-6">
      <AdminPanel title="Actions" description="Draft quotes can be saved, versioned, and sent to the client.">
        <div className="flex flex-wrap gap-2">
          {canSendQuote(quote.status) ? (
            <ActionForm action={sendQuoteToClient}>
              <input type="hidden" name="quoteId" value={quote.id} />
              <SubmitButton pendingLabel="Sending…">Send to client</SubmitButton>
            </ActionForm>
          ) : null}
          {canCreateQuoteVersion(quote.status) ? (
            <ActionForm action={createQuoteVersion}>
              <input type="hidden" name="quoteId" value={quote.id} />
              <SubmitButton variant="secondary" pendingLabel="Creating version…">
                Create new version
              </SubmitButton>
            </ActionForm>
          ) : null}
        </div>
      </AdminPanel>

      <AdminPanel
        title="Status workflow"
        description="Only allowed quote_status transitions can be applied."
      >
        {transitions.length === 0 ? (
          <p className="text-sm text-muted">
            {formatQuoteStatusLabel(quote.status)} is a terminal status.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {transitions.map((status) => (
              <ActionForm key={status} action={updateQuoteStatus}>
                <input type="hidden" name="quoteId" value={quote.id} />
                <input type="hidden" name="status" value={status} />
                <SubmitButton variant="secondary" pendingLabel="Updating…">
                  {`Mark ${formatQuoteStatusLabel(status).toLowerCase()}`}
                </SubmitButton>
              </ActionForm>
            ))}
          </div>
        )}
      </AdminPanel>

      <AdminPanel
        title="PDF export"
        description={
          pdfReady
            ? "Download a PDF using the configured quote exporter."
            : "PDF generation is not implemented yet. This is the extension point for a future exporter."
        }
      >
        <button
          type="button"
          disabled
          className="rounded-xl border border-card-border px-3 py-2 text-sm text-muted disabled:opacity-60"
        >
          Export PDF
        </button>
      </AdminPanel>
    </div>
  );
}
