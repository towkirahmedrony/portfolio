"use client";

import {
  DISCOUNT_TYPE_OPTIONS,
  formatMoney,
  parseDiscountType,
  type DiscountType,
  type QuoteTotals,
} from "@/lib/quote-money";

const fieldClass =
  "w-full rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground";

export function DiscountFields({
  discountType,
  discountValue,
  tax,
  totals,
  currency,
  readOnly,
  onDiscountTypeChange,
  onDiscountValueChange,
  onTaxChange,
}: {
  discountType: DiscountType;
  discountValue: string;
  tax: string;
  totals: QuoteTotals;
  currency: string;
  readOnly: boolean;
  onDiscountTypeChange: (value: DiscountType) => void;
  onDiscountValueChange: (value: string) => void;
  onTaxChange: (value: string) => void;
}) {
  const isPercent = discountType === "percent";

  return (
    <>
      <input type="hidden" name="discount_total" value={totals.discount_total} />
      <label className="grid gap-2">
        <span className="text-muted">Discount type</span>
        <select
          name="discount_type"
          value={discountType}
          onChange={(event) => onDiscountTypeChange(parseDiscountType(event.target.value))}
          disabled={readOnly}
          className={fieldClass}
        >
          {DISCOUNT_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center justify-between gap-3">
        <span className="text-muted">{isPercent ? "Discount %" : "Discount"}</span>
        <input
          name="discount_value"
          type="number"
          min="0"
          max={isPercent ? "100" : undefined}
          step="0.01"
          value={discountValue}
          onChange={(event) => onDiscountValueChange(event.target.value)}
          disabled={readOnly}
          className={`${fieldClass} max-w-36 text-right`}
        />
      </label>
      {isPercent ? (
        <div className="flex items-center justify-between">
          <dt className="text-muted">Discount amount</dt>
          <dd className="font-medium text-foreground">
            {formatMoney(totals.discount_total, currency)}
          </dd>
        </div>
      ) : null}
      <label className="flex items-center justify-between gap-3">
        <span className="text-muted">Tax</span>
        <input
          name="tax_total"
          type="number"
          min="0"
          step="0.01"
          value={tax}
          onChange={(event) => onTaxChange(event.target.value)}
          disabled={readOnly}
          className={`${fieldClass} max-w-36 text-right`}
        />
      </label>
    </>
  );
}
