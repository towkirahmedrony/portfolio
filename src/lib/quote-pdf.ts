import type { ProjectClient } from "@/lib/admin-project-constants";
import type { QuoteProjectSummary } from "@/lib/admin-quote-constants";
import type { QuoteItemRow, QuoteRow } from "@/types/database";

export type QuotePdfPayload = {
  quote: QuoteRow;
  items: QuoteItemRow[];
  project: QuoteProjectSummary | null;
  client: ProjectClient | null;
};

export type QuotePdfExporter = (payload: QuotePdfPayload) => Promise<Blob>;

export const quotePdfExporter: QuotePdfExporter | null = null;

export function isQuotePdfExportSupported(): boolean {
  return quotePdfExporter != null;
}

export async function exportQuotePdf(payload: QuotePdfPayload): Promise<Blob> {
  if (!quotePdfExporter) {
    throw new Error("Quote PDF export is not configured.");
  }

  return quotePdfExporter(payload);
}
