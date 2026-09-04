export const MONEY_DECIMALS = 2;
export const MONEY_TOLERANCE = 0.005;

export function parseNumeric(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round((value + Number.EPSILON) * 10 ** MONEY_DECIMALS) / 10 ** MONEY_DECIMALS;
}

export function toPostgresNumeric(value: number): number {
  return roundMoney(value);
}

export function moneyEquals(left: number, right: number): boolean {
  return Math.abs(roundMoney(left) - roundMoney(right)) <= MONEY_TOLERANCE;
}

export function lineAmount(quantity: number, unitPrice: number): number {
  return roundMoney(quantity * unitPrice);
}

export type QuoteLineInput = {
  description: string;
  quantity: number;
  unit_price: number;
};

export type QuoteTotals = {
  subtotal: number;
  discount_total: number;
  tax_total: number;
  total: number;
};

export type QuoteCalculationResult =
  | { ok: true; items: Array<QuoteLineInput & { amount: number }>; totals: QuoteTotals }
  | { ok: false; error: string };

export function calculateQuoteFinancials(
  items: QuoteLineInput[],
  discountTotal: number,
  taxTotal: number,
): QuoteCalculationResult {
  if (!Number.isFinite(discountTotal) || !Number.isFinite(taxTotal)) {
    return { ok: false, error: "Discount and tax must be valid numbers." };
  }

  if (discountTotal < 0 || taxTotal < 0) {
    return { ok: false, error: "Discount and tax cannot be negative." };
  }

  const normalized: Array<QuoteLineInput & { amount: number }> = [];

  for (const item of items) {
    const description = item.description.trim();
    if (!description) {
      return { ok: false, error: "Each line item needs a description." };
    }
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      return { ok: false, error: "Quantity must be greater than zero." };
    }
    if (!Number.isFinite(item.unit_price) || item.unit_price < 0) {
      return { ok: false, error: "Unit price cannot be negative." };
    }

    const quantity = roundMoney(item.quantity);
    const unitPrice = roundMoney(item.unit_price);
    const amount = lineAmount(quantity, unitPrice);

    if (amount < 0 || !Number.isFinite(amount)) {
      return { ok: false, error: "Line amount is invalid." };
    }

    normalized.push({
      description,
      quantity,
      unit_price: unitPrice,
      amount,
    });
  }

  const subtotal = roundMoney(normalized.reduce((sum, item) => sum + item.amount, 0));
  const discount = roundMoney(discountTotal);
  const tax = roundMoney(taxTotal);

  if (discount > subtotal) {
    return { ok: false, error: "Discount cannot exceed subtotal." };
  }

  const total = roundMoney(subtotal - discount + tax);

  if (!Number.isFinite(total) || total < 0) {
    return { ok: false, error: "Quote total must be a valid non-negative amount." };
  }

  return {
    ok: true,
    items: normalized,
    totals: {
      subtotal,
      discount_total: discount,
      tax_total: tax,
      total,
    },
  };
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    const digits = amount % 1 === 0 ? 0 : 2;
    return `${amount.toFixed(digits)} ${currency}`;
  }
}

export function paymentContribution(payment: {
  amount: number;
  status: string;
  payment_type: string;
}): number {
  if (payment.status !== "succeeded") {
    return 0;
  }

  const amount = roundMoney(Number(payment.amount));
  if (!Number.isFinite(amount) || amount < 0) {
    return 0;
  }

  return payment.payment_type === "refund" ? -amount : amount;
}

export function sumSucceededPayments(
  payments: Array<{ amount: number; status: string; payment_type: string }>,
): number {
  return roundMoney(payments.reduce((sum, payment) => sum + paymentContribution(payment), 0));
}

export function calculateAmountDue(total: number, amountPaid: number): number {
  return roundMoney(Math.max(0, roundMoney(total) - roundMoney(amountPaid)));
}

export function assertMatchingTotals(
  submitted: QuoteTotals,
  calculated: QuoteTotals,
): string | null {
  if (!moneyEquals(submitted.subtotal, calculated.subtotal)) {
    return "Subtotal does not match line items.";
  }
  if (!moneyEquals(submitted.discount_total, calculated.discount_total)) {
    return "Discount total is invalid.";
  }
  if (!moneyEquals(submitted.tax_total, calculated.tax_total)) {
    return "Tax total is invalid.";
  }
  if (!moneyEquals(submitted.total, calculated.total)) {
    return "Final total does not match subtotal, discount, and tax.";
  }
  return null;
}
