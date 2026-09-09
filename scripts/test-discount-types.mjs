import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function read(relativePath) {
  return fs.readFileSync(path.join("/workspace", relativePath), "utf8");
}

function transpileToTemp(sourcePath) {
  const source = fs.readFileSync(sourcePath, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourcePath,
  });
  const outFile = path.join("/tmp/opencode", `${path.basename(sourcePath, ".ts")}.mjs`);
  fs.writeFileSync(outFile, outputText);
  return pathToFileURL(outFile).href;
}

const moneyHref = transpileToTemp(path.join("/workspace", "src/lib/quote-money.ts"));
const money = await import(moneyHref);

const items = [{ description: "Website", quantity: 1, unit_price: 10000 }];

const amount = money.calculateQuoteFinancialsFromDiscount(items, "amount", 1000, 500);
assert(amount.ok, amount.ok ? "" : amount.error);
assert(amount.totals.subtotal === 10000, "amount subtotal");
assert(amount.totals.discount_total === 1000, "BDT + 1000 should discount 1000");
assert(amount.totals.tax_total === 500, "amount tax");
assert(amount.totals.total === 9500, "amount final total");

const percent = money.calculateQuoteFinancialsFromDiscount(items, "percent", 10, 500);
assert(percent.ok, percent.ok ? "" : percent.error);
assert(percent.totals.subtotal === 10000, "percent subtotal");
assert(percent.totals.discount_total === 1000, "% + 10 should discount 10% of subtotal");
assert(percent.totals.tax_total === 500, "percent tax");
assert(percent.totals.total === 9500, "percent final total");

const emptyDiscount = money.parseDiscountFormInput("amount", "");
assert(emptyDiscount.ok && emptyDiscount.value === 0, "empty discount becomes 0");
const emptyCalc = money.calculateQuoteFinancialsFromDiscount(items, "amount", 0, money.moneyInputOrZero(""));
assert(emptyCalc.ok, emptyCalc.ok ? "" : emptyCalc.error);
assert(emptyCalc.totals.discount_total === 0, "empty discount total is 0");
assert(emptyCalc.totals.tax_total === 0, "empty tax becomes 0");
assert(emptyCalc.totals.total === 10000, "empty discount keeps full total");

const overPercent = money.parseDiscountFormInput("percent", "101");
assert(!overPercent.ok, "percent above 100 is invalid");

const negative = money.parseDiscountFormInput("amount", "-1");
assert(!negative.ok, "negative discount is invalid");

const reloadAmount = money.calculateQuoteFinancialsFromDiscount(items, "amount", 1000, 0);
assert(reloadAmount.ok && reloadAmount.totals.discount_total === 1000, "saved amount reloads as amount");

const quoteMoney = read("src/lib/quote-money.ts");
const quoteEditor = read("src/components/admin/quotes/quote-editor.tsx");
const invoiceEditor = read("src/components/admin/invoices/invoice-editor.tsx");
const discountFields = read("src/components/admin/finance/discount-fields.tsx");
const quoteActions = read("src/lib/admin-quote-actions.ts");
const invoiceActions = read("src/lib/admin-invoice-actions.ts");

assert(quoteMoney.includes("BDT / Amount"), "amount option label");
assert(quoteMoney.includes("% / Percentage"), "percent option label");
assert(discountFields.includes('name="discount_type"'), "discount type field");
assert(discountFields.includes('name="discount_value"'), "discount value field");
assert(quoteEditor.includes("DiscountFields"), "quote editor uses shared discount fields");
assert(invoiceEditor.includes("DiscountFields"), "invoice editor uses shared discount fields");
assert(quoteEditor.includes("calculateQuoteFinancialsFromDiscount"), "quote editor uses shared calc");
assert(invoiceEditor.includes("calculateQuoteFinancialsFromDiscount"), "invoice editor uses shared calc");
assert(quoteActions.includes("calculateQuoteFinancialsFromDiscount"), "quote save uses shared calc");
assert(invoiceActions.includes("calculateQuoteFinancialsFromDiscount"), "invoice save uses shared calc");

console.log("discount type tests passed");
