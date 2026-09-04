"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canEditInvoiceItems,
  canIssueInvoice,
  canRecordManualPayment,
  deriveInvoiceStatusFromBalances,
  getAllowedInvoiceTransitions,
  isInvoiceOverdue,
  isInvoiceStatus,
  isPaymentType,
} from "@/lib/admin-invoice-constants";
import { requireAdmin } from "@/lib/require-admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  assertMatchingTotals,
  calculateAmountDue,
  calculateQuoteFinancials,
  parseNumeric,
  roundMoney,
  sumSucceededPayments,
  toPostgresNumeric,
  type QuoteLineInput,
} from "@/lib/quote-money";
import type { InvoiceRow, InvoiceStatus, PaymentRow } from "@/types/database";

type ActionResult = { ok: true; invoiceId?: string } | { ok: false; error: string };

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalString(value: FormDataEntryValue | null): string | null {
  const next = asString(value);
  return next ? next : null;
}

function asRequiredNumber(value: FormDataEntryValue | null, label: string): number {
  const parsed = parseNumeric(asString(value));
  if (parsed == null) {
    throw new Error(`${label} must be a valid number.`);
  }
  return parsed;
}

function parseLineItems(formData: FormData): QuoteLineInput[] {
  const descriptions = formData.getAll("item_description");
  const quantities = formData.getAll("item_quantity");
  const unitPrices = formData.getAll("item_unit_price");
  const length = Math.max(descriptions.length, quantities.length, unitPrices.length);
  const items: QuoteLineInput[] = [];

  for (let index = 0; index < length; index += 1) {
    const description = asString(descriptions[index] ?? null);
    const quantityRaw = asString(quantities[index] ?? null);
    const unitPriceRaw = asString(unitPrices[index] ?? null);

    if (!description && !quantityRaw && !unitPriceRaw) {
      continue;
    }

    const quantity = parseNumeric(quantityRaw);
    const unitPrice = parseNumeric(unitPriceRaw);
    if (quantity == null || unitPrice == null) {
      throw new Error("Each line item needs a valid quantity and unit price.");
    }

    items.push({
      description,
      quantity,
      unit_price: unitPrice,
    });
  }

  return items;
}

function revalidateInvoices(invoiceId?: string, projectId?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/invoices");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/payment-events");
  if (invoiceId) {
    revalidatePath(`/admin/invoices/${invoiceId}`);
  }
  if (projectId) {
    revalidatePath(`/admin/projects/${projectId}`);
  }
}

async function writeAuditLog(input: {
  actorId: string;
  action: string;
  entityType?: string;
  entityId: string;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
}) {
  try {
    const supabase = await createServerSupabaseClient();
    await supabase.from("audit_logs").insert({
      actor_id: input.actorId,
      action: input.action,
      entity_type: input.entityType ?? "invoice",
      entity_id: input.entityId,
      old_data: input.oldData ?? null,
      new_data: input.newData ?? null,
    });
  } catch {
    // Audit logging is best-effort and must not block invoice workflows.
  }
}

function dateOrNull(value: string | null): string | null {
  if (!value) {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Date must use YYYY-MM-DD.");
  }
  return value;
}

export async function createInvoiceFromQuote(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const quoteId = asString(formData.get("quoteId"));
  let dueDate: string | null;

  try {
    dueDate = dateOrNull(asOptionalString(formData.get("due_date")));
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Invalid due date." };
  }

  if (!quoteId) {
    return { ok: false, error: "Select an accepted quote." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("admin_create_invoice_from_quote", {
    p_quote_id: quoteId,
    p_due_date: dueDate,
  });

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not create invoice from quote." };
  }

  const invoiceId = String(data);
  await writeAuditLog({
    actorId: admin.id,
    action: "invoice.created_from_quote",
    entityId: invoiceId,
    newData: { quote_id: quoteId, due_date: dueDate },
  });

  revalidateInvoices(invoiceId);
  redirect(`/admin/invoices/${invoiceId}`);
  return { ok: true, invoiceId };
}

export async function saveInvoiceDraft(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const invoiceId = asString(formData.get("invoiceId"));

  if (!invoiceId) {
    return { ok: false, error: "Missing invoice." };
  }

  let discountTotal: number;
  let taxTotal: number;
  let submittedTotals;
  let items;
  let dueDate: string | null;

  try {
    discountTotal = asRequiredNumber(formData.get("discount_total"), "Discount");
    taxTotal = asRequiredNumber(formData.get("tax_total"), "Tax");
    submittedTotals = {
      subtotal: asRequiredNumber(formData.get("subtotal"), "Subtotal"),
      discount_total: discountTotal,
      tax_total: taxTotal,
      total: asRequiredNumber(formData.get("total"), "Total"),
    };
    items = parseLineItems(formData);
    dueDate = dateOrNull(asOptionalString(formData.get("due_date")));
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Invalid invoice data." };
  }

  if (items.length === 0) {
    return { ok: false, error: "Add at least one line item." };
  }

  const calculated = calculateQuoteFinancials(items, discountTotal, taxTotal);
  if (!calculated.ok) {
    return { ok: false, error: calculated.error };
  }

  const mismatch = assertMatchingTotals(submittedTotals, calculated.totals);
  if (mismatch) {
    return { ok: false, error: mismatch };
  }

  const supabase = await createServerSupabaseClient();
  const { data: existing, error: existingError } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();

  if (existingError) {
    return { ok: false, error: existingError.message };
  }
  if (!existing) {
    return { ok: false, error: "Invoice not found." };
  }
  if (!canEditInvoiceItems(existing.status)) {
    return { ok: false, error: "Only draft invoices can be edited." };
  }

  const amountPaid = roundMoney(Number(existing.amount_paid ?? 0));
  const total = calculated.totals.total;
  if (amountPaid > total + 0.005) {
    return { ok: false, error: "Amount paid cannot exceed the invoice total." };
  }

  const amountDue = calculateAmountDue(total, amountPaid);
  const totals = {
    subtotal: toPostgresNumeric(calculated.totals.subtotal),
    discount_total: toPostgresNumeric(calculated.totals.discount_total),
    tax_total: toPostgresNumeric(calculated.totals.tax_total),
    total: toPostgresNumeric(total),
    amount_paid: toPostgresNumeric(amountPaid),
    amount_due: toPostgresNumeric(amountDue),
  };

  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      ...totals,
      due_date: dueDate,
      status: "draft",
    })
    .eq("id", invoiceId)
    .eq("status", "draft");

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  const { error: deleteError } = await supabase
    .from("invoice_items")
    .delete()
    .eq("invoice_id", invoiceId);

  if (deleteError) {
    return { ok: false, error: deleteError.message };
  }

  const { error: itemsError } = await supabase.from("invoice_items").insert(
    calculated.items.map((item) => ({
      invoice_id: invoiceId,
      description: item.description,
      quantity: toPostgresNumeric(item.quantity),
      unit_price: toPostgresNumeric(item.unit_price),
      amount: toPostgresNumeric(item.amount),
    })),
  );

  if (itemsError) {
    return { ok: false, error: itemsError.message };
  }

  await writeAuditLog({
    actorId: admin.id,
    action: "invoice.draft_saved",
    entityId: invoiceId,
    oldData: existing as unknown as Record<string, unknown>,
    newData: totals,
  });

  revalidateInvoices(invoiceId, existing.project_id);
  return { ok: true, invoiceId };
}

export async function issueInvoice(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const invoiceId = asString(formData.get("invoiceId"));

  if (!invoiceId) {
    return { ok: false, error: "Missing invoice." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();

  if (invoiceError) {
    return { ok: false, error: invoiceError.message };
  }
  if (!invoice) {
    return { ok: false, error: "Invoice not found." };
  }
  if (!canIssueInvoice(invoice.status)) {
    return { ok: false, error: "Only draft invoices can be issued." };
  }

  const { data: items, error: itemsError } = await supabase
    .from("invoice_items")
    .select("id")
    .eq("invoice_id", invoiceId)
    .limit(1);

  if (itemsError) {
    return { ok: false, error: itemsError.message };
  }
  if (!items || items.length === 0) {
    return { ok: false, error: "Add line items before issuing this invoice." };
  }

  const issueDate = invoice.issue_date || new Date().toISOString().slice(0, 10);
  const total = roundMoney(Number(invoice.total ?? 0));
  const amountPaid = roundMoney(Number(invoice.amount_paid ?? 0));
  const amountDue = calculateAmountDue(total, amountPaid);

  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      status: "issued",
      issue_date: issueDate,
      amount_due: toPostgresNumeric(amountDue),
    })
    .eq("id", invoiceId)
    .eq("status", "draft");

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  await writeAuditLog({
    actorId: admin.id,
    action: "invoice.issued",
    entityId: invoiceId,
    oldData: { status: invoice.status },
    newData: { status: "issued", issue_date: issueDate },
  });

  revalidateInvoices(invoiceId, invoice.project_id);
  return { ok: true, invoiceId };
}

export async function updateInvoiceStatus(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const invoiceId = asString(formData.get("invoiceId"));
  const statusRaw = asString(formData.get("status"));

  if (!invoiceId) {
    return { ok: false, error: "Missing invoice." };
  }
  if (!isInvoiceStatus(statusRaw)) {
    return { ok: false, error: "Invalid invoice status." };
  }

  const nextStatus = statusRaw as InvoiceStatus;
  const supabase = await createServerSupabaseClient();
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();

  if (invoiceError) {
    return { ok: false, error: invoiceError.message };
  }
  if (!invoice) {
    return { ok: false, error: "Invoice not found." };
  }

  const allowed = getAllowedInvoiceTransitions(invoice.status);
  if (!allowed.includes(nextStatus)) {
    return {
      ok: false,
      error: `Cannot change status from ${invoice.status} to ${nextStatus}.`,
    };
  }

  const patch: Partial<InvoiceRow> = { status: nextStatus };
  const now = new Date().toISOString();

  if (nextStatus === "issued" && !invoice.issue_date) {
    patch.issue_date = now.slice(0, 10);
  }
  if (nextStatus === "paid" && !invoice.paid_at) {
    patch.paid_at = now;
  }
  if (nextStatus === "refunded") {
    patch.paid_at = null;
  }

  const { error: updateError } = await supabase
    .from("invoices")
    .update(patch)
    .eq("id", invoiceId)
    .eq("status", invoice.status);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  await writeAuditLog({
    actorId: admin.id,
    action: "invoice.status_updated",
    entityId: invoiceId,
    oldData: { status: invoice.status },
    newData: { status: nextStatus },
  });

  revalidateInvoices(invoiceId, invoice.project_id);
  return { ok: true, invoiceId };
}

export async function recordManualPayment(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const invoiceId = asString(formData.get("invoiceId"));
  const paymentTypeRaw = asString(formData.get("payment_type")) || "full";
  const paymentMethod = asOptionalString(formData.get("payment_method"));
  const provider = asOptionalString(formData.get("provider")) ?? "manual";
  const transactionReference = asOptionalString(formData.get("transaction_reference"));
  const paidAtRaw = asOptionalString(formData.get("paid_at"));

  if (!invoiceId) {
    return { ok: false, error: "Missing invoice." };
  }
  if (!isPaymentType(paymentTypeRaw)) {
    return { ok: false, error: "Invalid payment type." };
  }

  let amount: number;
  try {
    amount = asRequiredNumber(formData.get("amount"), "Amount");
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Invalid amount." };
  }

  if (amount <= 0) {
    return { ok: false, error: "Payment amount must be greater than zero." };
  }

  let paidAt: string | null = null;
  if (paidAtRaw) {
    const parsed = new Date(paidAtRaw);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: "Paid date must be valid." };
    }
    paidAt = parsed.toISOString();
  }

  const supabase = await createServerSupabaseClient();
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();

  if (invoiceError) {
    return { ok: false, error: invoiceError.message };
  }
  if (!invoice) {
    return { ok: false, error: "Invoice not found." };
  }
  if (!canRecordManualPayment(invoice.status) && paymentTypeRaw !== "refund") {
    return { ok: false, error: "Manual payments can only be recorded on issued invoices." };
  }

  const { data: existingPayments, error: paymentsError } = await supabase
    .from("payments")
    .select("amount, status, payment_type")
    .eq("invoice_id", invoiceId);

  if (paymentsError) {
    return { ok: false, error: paymentsError.message };
  }

  const currentPaid = sumSucceededPayments((existingPayments ?? []) as PaymentRow[]);
  const roundedAmount = roundMoney(amount);
  const nextPaid =
    paymentTypeRaw === "refund"
      ? roundMoney(currentPaid - roundedAmount)
      : roundMoney(currentPaid + roundedAmount);
  const invoiceTotal = roundMoney(Number(invoice.total ?? 0));

  if (paymentTypeRaw === "refund" && roundedAmount > currentPaid + 0.005) {
    return { ok: false, error: "Refund cannot exceed the amount already paid." };
  }
  if (paymentTypeRaw !== "refund" && nextPaid > invoiceTotal + 0.005) {
    return { ok: false, error: "Amount paid cannot exceed the invoice total." };
  }

  const { data, error } = await supabase.rpc("admin_record_manual_payment", {
    p_invoice_id: invoiceId,
    p_amount: toPostgresNumeric(roundedAmount),
    p_payment_type: paymentTypeRaw,
    p_payment_method: paymentMethod,
    p_provider: provider,
    p_transaction_reference: transactionReference,
    p_paid_at: paidAt,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const amountDue = calculateAmountDue(invoiceTotal, nextPaid);
  const derived = deriveInvoiceStatusFromBalances({
    currentStatus: invoice.status,
    total: invoiceTotal,
    amountPaid: nextPaid,
    amountDue,
    isOverdue: isInvoiceOverdue(invoice),
  });

  await writeAuditLog({
    actorId: admin.id,
    action: paymentTypeRaw === "refund" ? "invoice.refund_recorded" : "invoice.payment_recorded",
    entityType: "payment",
    entityId: data ? String(data) : invoiceId,
    newData: {
      invoice_id: invoiceId,
      amount: roundedAmount,
      payment_type: paymentTypeRaw,
      derived_status: derived,
    },
  });

  revalidateInvoices(invoiceId, invoice.project_id);
  return { ok: true, invoiceId };
}
