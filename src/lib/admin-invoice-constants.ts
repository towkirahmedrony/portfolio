import type { ProjectClient } from "@/lib/admin-project-constants";
import type {
  InvoiceItemRow,
  InvoiceRow,
  InvoiceStatus,
  PaymentRow,
  PaymentStatus,
  PaymentType,
  ProjectRow,
  QuoteRow,
} from "@/types/database";

export const INVOICE_STATUSES: InvoiceStatus[] = [
  "draft",
  "issued",
  "partially_paid",
  "paid",
  "overdue",
  "cancelled",
  "refunded",
];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  issued: "Issued",
  partially_paid: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export const INVOICE_STATUS_STYLES: Record<InvoiceStatus, string> = {
  draft: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400",
  issued: "bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-400",
  partially_paid: "bg-purple-500/10 text-purple-700 border-purple-500/20 dark:text-purple-400",
  paid: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400",
  overdue: "bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-400",
  cancelled: "bg-neutral-500/10 text-neutral-500 border-neutral-500/20",
  refunded: "bg-orange-500/10 text-orange-700 border-orange-500/20 dark:text-orange-400",
};

export const INVOICE_STATUS_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ["issued", "cancelled"],
  issued: ["overdue", "cancelled"],
  partially_paid: ["overdue", "cancelled", "refunded"],
  paid: ["refunded"],
  overdue: ["cancelled", "refunded"],
  cancelled: [],
  refunded: [],
};

export const PAYMENT_STATUSES: PaymentStatus[] = [
  "pending",
  "processing",
  "succeeded",
  "failed",
  "cancelled",
  "refunded",
  "partially_refunded",
];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  succeeded: "Succeeded",
  failed: "Failed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
};

export const PAYMENT_STATUS_STYLES: Record<PaymentStatus, string> = {
  pending: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400",
  processing: "bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-400",
  succeeded: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400",
  failed: "bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-400",
  cancelled: "bg-neutral-500/10 text-neutral-500 border-neutral-500/20",
  refunded: "bg-orange-500/10 text-orange-700 border-orange-500/20 dark:text-orange-400",
  partially_refunded: "bg-purple-500/10 text-purple-700 border-purple-500/20 dark:text-purple-400",
};

export const PAYMENT_TYPES: PaymentType[] = [
  "advance",
  "milestone",
  "final",
  "full",
  "refund",
];

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  advance: "Advance",
  milestone: "Milestone",
  final: "Final",
  full: "Full",
  refund: "Refund",
};

export type InvoiceListFilters = {
  status?: string;
};

export type PaymentListFilters = {
  status?: string;
  type?: string;
};

export type PaymentEventListFilters = {
  q?: string;
  processed?: string;
  provider?: string;
};

export type InvoiceProjectSummary = Pick<
  ProjectRow,
  "id" | "project_number" | "title" | "client_id" | "currency"
>;

export type InvoiceClient = ProjectClient & {
  phone?: string | null;
  job_title?: string | null;
};

export type AdminInvoiceListItem = InvoiceRow & {
  project: InvoiceProjectSummary | null;
  client: InvoiceClient | null;
  isOverdue: boolean;
};

export type AdminInvoiceDetail = {
  invoice: InvoiceRow;
  items: InvoiceItemRow[];
  project: InvoiceProjectSummary | null;
  client: InvoiceClient | null;
  quote: Pick<QuoteRow, "id" | "version" | "status" | "total" | "currency"> | null;
  payments: PaymentRow[];
};

export type AcceptedQuoteOption = {
  id: string;
  version: number;
  total: number;
  currency: string;
  project: InvoiceProjectSummary | null;
  client: InvoiceClient | null;
};

export type AdminPaymentListItem = PaymentRow & {
  project: InvoiceProjectSummary | null;
  client: InvoiceClient | null;
  invoice: Pick<InvoiceRow, "id" | "invoice_number" | "status" | "currency"> | null;
};

export function isInvoiceStatus(value: string): value is InvoiceStatus {
  return INVOICE_STATUSES.includes(value as InvoiceStatus);
}

export function isPaymentStatus(value: string): value is PaymentStatus {
  return PAYMENT_STATUSES.includes(value as PaymentStatus);
}

export function isPaymentType(value: string): value is PaymentType {
  return PAYMENT_TYPES.includes(value as PaymentType);
}

export function formatInvoiceStatusLabel(status: string): string {
  if (isInvoiceStatus(status)) {
    return INVOICE_STATUS_LABELS[status];
  }
  return status.replace(/_/g, " ");
}

export function formatPaymentStatusLabel(status: string): string {
  if (isPaymentStatus(status)) {
    return PAYMENT_STATUS_LABELS[status];
  }
  return status.replace(/_/g, " ");
}

export function formatPaymentTypeLabel(type: string): string {
  if (isPaymentType(type)) {
    return PAYMENT_TYPE_LABELS[type];
  }
  return type.replace(/_/g, " ");
}

export function getInvoiceStatusStyle(status: string): string {
  return isInvoiceStatus(status)
    ? INVOICE_STATUS_STYLES[status]
    : "border-card-border bg-background text-muted";
}

export function getPaymentStatusStyle(status: string): string {
  return isPaymentStatus(status)
    ? PAYMENT_STATUS_STYLES[status]
    : "border-card-border bg-background text-muted";
}

export function getAllowedInvoiceTransitions(status: InvoiceStatus): InvoiceStatus[] {
  return INVOICE_STATUS_TRANSITIONS[status];
}

export function canEditInvoiceItems(status: InvoiceStatus): boolean {
  return status === "draft";
}

export function canIssueInvoice(status: InvoiceStatus): boolean {
  return status === "draft";
}

export function canRecordManualPayment(status: InvoiceStatus): boolean {
  return status === "issued" || status === "partially_paid" || status === "overdue" || status === "paid";
}

export function isInvoiceOverdue(invoice: Pick<InvoiceRow, "status" | "due_date">): boolean {
  if (invoice.status === "overdue") {
    return true;
  }
  if (
    invoice.status !== "issued" &&
    invoice.status !== "partially_paid"
  ) {
    return false;
  }
  if (!invoice.due_date) {
    return false;
  }
  const due = new Date(`${invoice.due_date}T23:59:59.999Z`);
  if (Number.isNaN(due.getTime())) {
    return false;
  }
  return due.getTime() < Date.now();
}

export function deriveInvoiceStatusFromBalances(input: {
  currentStatus: InvoiceStatus;
  total: number;
  amountPaid: number;
  amountDue: number;
  isOverdue: boolean;
}): InvoiceStatus {
  const { currentStatus, total, amountPaid, amountDue, isOverdue } = input;

  if (currentStatus === "draft" || currentStatus === "cancelled") {
    return currentStatus;
  }

  if (currentStatus === "refunded") {
    return "refunded";
  }

  if (amountPaid < 0 && Math.abs(amountPaid) > 0) {
    return "refunded";
  }

  if (amountDue <= 0 && amountPaid >= total && total > 0) {
    return "paid";
  }

  if (amountPaid > 0 && amountDue > 0) {
    return isOverdue ? "overdue" : "partially_paid";
  }

  if (isOverdue && (currentStatus === "issued" || currentStatus === "partially_paid" || currentStatus === "overdue")) {
    return "overdue";
  }

  return currentStatus === "paid" ? "issued" : currentStatus;
}

export function buildInvoicesHref(filters: InvoiceListFilters): string {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }
  const query = params.toString();
  return query ? `/admin/invoices?${query}` : "/admin/invoices";
}

export function buildPaymentsHref(filters: PaymentListFilters): string {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }
  if (filters.type && filters.type !== "all") {
    params.set("type", filters.type);
  }
  const query = params.toString();
  return query ? `/admin/payments?${query}` : "/admin/payments";
}

export function buildPaymentEventsHref(filters: PaymentEventListFilters): string {
  const params = new URLSearchParams();
  if (filters.q) {
    params.set("q", filters.q);
  }
  if (filters.processed && filters.processed !== "all") {
    params.set("processed", filters.processed);
  }
  if (filters.provider) {
    params.set("provider", filters.provider);
  }
  const query = params.toString();
  return query ? `/admin/payment-events?${query}` : "/admin/payment-events";
}
