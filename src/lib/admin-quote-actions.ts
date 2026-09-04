"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/require-admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  canCreateQuoteVersion,
  canEditQuote,
  canSendQuote,
  getAllowedQuoteTransitions,
  isQuoteStatus,
} from "@/lib/admin-quote-constants";
import {
  assertMatchingTotals,
  calculateQuoteFinancials,
  parseNumeric,
  toPostgresNumeric,
  type QuoteLineInput,
} from "@/lib/quote-money";
import type { QuoteItemRow, QuoteRow, QuoteStatus } from "@/types/database";

type ActionResult = { ok: true; quoteId?: string } | { ok: false; error: string };

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

function datetimeLocalToIso(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Valid until must be a valid date.");
  }
  return date.toISOString();
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

function revalidateQuotes(quoteId?: string, projectId?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/quotes");
  if (quoteId) {
    revalidatePath(`/admin/quotes/${quoteId}`);
  }
  if (projectId) {
    revalidatePath(`/admin/projects/${projectId}`);
  }
}

function redirectToQuote(quoteId: string) {
  redirect(`/admin/quotes/${quoteId}`);
}

async function writeAuditLog(input: {
  actorId: string;
  action: string;
  entityId: string;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
}) {
  try {
    const supabase = await createServerSupabaseClient();
    await supabase.from("audit_logs").insert({
      actor_id: input.actorId,
      action: input.action,
      entity_type: "quote",
      entity_id: input.entityId,
      old_data: input.oldData ?? null,
      new_data: input.newData ?? null,
    });
  } catch {
    // Audit logging is best-effort and must not block quote workflows.
  }
}

function currencyFromProject(projectCurrency: string | null | undefined, fallback: string) {
  const currency = projectCurrency?.trim() || fallback.trim() || "BDT";
  if (!currency) {
    throw new Error("Currency is required.");
  }
  return currency;
}

export async function saveQuoteDraft(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const quoteId = asOptionalString(formData.get("quoteId"));
  const projectId = asString(formData.get("projectId"));
  const notes = asOptionalString(formData.get("notes"));
  const terms = asOptionalString(formData.get("terms"));

  if (!projectId) {
    return { ok: false, error: "Select a project." };
  }

  let discountTotal: number;
  let taxTotal: number;
  let submittedTotals;
  let items;

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
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Invalid quote data." };
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

  let validUntil: string | null;
  try {
    validUntil = datetimeLocalToIso(asOptionalString(formData.get("valid_until")));
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Invalid valid-until date." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, client_id, currency")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    return { ok: false, error: projectError.message };
  }
  if (!project) {
    return { ok: false, error: "Project not found." };
  }

  const totals = {
    subtotal: toPostgresNumeric(calculated.totals.subtotal),
    discount_total: toPostgresNumeric(calculated.totals.discount_total),
    tax_total: toPostgresNumeric(calculated.totals.tax_total),
    total: toPostgresNumeric(calculated.totals.total),
  };

  if (quoteId) {
    const { data: existing, error: existingError } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", quoteId)
      .maybeSingle();

    if (existingError) {
      return { ok: false, error: existingError.message };
    }
    if (!existing) {
      return { ok: false, error: "Quote not found." };
    }
    if (existing.project_id !== projectId) {
      return { ok: false, error: "Quote project cannot be changed." };
    }
    if (!canEditQuote(existing.status)) {
      return { ok: false, error: "Only draft quotes can be edited. Create a new version instead." };
    }

    const { error: updateError } = await supabase
      .from("quotes")
      .update({
        notes,
        terms,
        valid_until: validUntil,
        currency: existing.currency || currencyFromProject(project.currency, existing.currency),
        ...totals,
        status: "draft",
      })
      .eq("id", quoteId)
      .eq("status", "draft");

    if (updateError) {
      return { ok: false, error: updateError.message };
    }

    const { error: deleteError } = await supabase
      .from("quote_items")
      .delete()
      .eq("quote_id", quoteId);

    if (deleteError) {
      return { ok: false, error: deleteError.message };
    }

    const { error: itemsError } = await supabase.from("quote_items").insert(
      calculated.items.map((item, index) => ({
        quote_id: quoteId,
        description: item.description,
        quantity: toPostgresNumeric(item.quantity),
        unit_price: toPostgresNumeric(item.unit_price),
        amount: toPostgresNumeric(item.amount),
        sort_order: index,
      })),
    );

    if (itemsError) {
      return { ok: false, error: itemsError.message };
    }

    await writeAuditLog({
      actorId: admin.id,
      action: "quote.draft_saved",
      entityId: quoteId,
      oldData: existing as unknown as Record<string, unknown>,
      newData: totals,
    });

    revalidateQuotes(quoteId, projectId);
    return { ok: true, quoteId };
  }

  const { data: latest } = await supabase
    .from("quotes")
    .select("version")
    .eq("project_id", projectId)
    .order("version", { ascending: false })
    .limit(1);

  const version = latest && latest.length > 0 ? Number(latest[0].version ?? 0) + 1 : 1;
  const currency = currencyFromProject(project.currency, "BDT");

  const { data: created, error: insertError } = await supabase
    .from("quotes")
    .insert({
      project_id: projectId,
      version,
      currency,
      notes,
      terms,
      valid_until: validUntil,
      status: "draft",
      ...totals,
    })
    .select("id")
    .single();

  if (insertError || !created) {
    return { ok: false, error: insertError?.message ?? "Could not create quote." };
  }

  const { error: itemsError } = await supabase.from("quote_items").insert(
    calculated.items.map((item, index) => ({
      quote_id: created.id,
      description: item.description,
      quantity: toPostgresNumeric(item.quantity),
      unit_price: toPostgresNumeric(item.unit_price),
      amount: toPostgresNumeric(item.amount),
      sort_order: index,
    })),
  );

  if (itemsError) {
    return { ok: false, error: itemsError.message };
  }

  await writeAuditLog({
    actorId: admin.id,
    action: "quote.created",
    entityId: created.id,
    newData: { version, ...totals },
  });

  revalidateQuotes(created.id, projectId);
  redirectToQuote(created.id);
  return { ok: true, quoteId: created.id };
}

export async function createQuoteVersion(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const sourceQuoteId = asString(formData.get("quoteId"));

  if (!sourceQuoteId) {
    return { ok: false, error: "Missing quote." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: source, error: sourceError } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", sourceQuoteId)
    .maybeSingle();

  if (sourceError) {
    return { ok: false, error: sourceError.message };
  }
  if (!source) {
    return { ok: false, error: "Quote not found." };
  }
  if (!canCreateQuoteVersion(source.status)) {
    return { ok: false, error: "A cancelled quote cannot be versioned." };
  }

  const { data: items, error: itemsError } = await supabase
    .from("quote_items")
    .select("*")
    .eq("quote_id", source.id)
    .order("sort_order", { ascending: true });

  if (itemsError) {
    return { ok: false, error: itemsError.message };
  }

  const { data: latest, error: latestError } = await supabase
    .from("quotes")
    .select("version")
    .eq("project_id", source.project_id)
    .order("version", { ascending: false })
    .limit(1);

  if (latestError) {
    return { ok: false, error: latestError.message };
  }

  const nextVersion = latest && latest.length > 0 ? Number(latest[0].version ?? 0) + 1 : 1;

  const { data: created, error: insertError } = await supabase
    .from("quotes")
    .insert({
      project_id: source.project_id,
      version: nextVersion,
      currency: source.currency,
      subtotal: source.subtotal,
      discount_total: source.discount_total,
      tax_total: source.tax_total,
      total: source.total,
      notes: source.notes,
      terms: source.terms,
      valid_until: source.valid_until,
      status: "draft",
    })
    .select("id")
    .single();

  if (insertError || !created) {
    return { ok: false, error: insertError?.message ?? "Could not create quote version." };
  }

  const sourceItems = (items ?? []) as QuoteItemRow[];
  if (sourceItems.length > 0) {
    const { error: copyError } = await supabase.from("quote_items").insert(
      sourceItems.map((item, index) => ({
        quote_id: created.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.amount,
        sort_order: item.sort_order ?? index,
      })),
    );

    if (copyError) {
      return { ok: false, error: copyError.message };
    }
  }

  await writeAuditLog({
    actorId: admin.id,
    action: "quote.version_created",
    entityId: created.id,
    oldData: { source_quote_id: source.id, source_version: source.version },
    newData: { version: nextVersion },
  });

  revalidateQuotes(created.id, source.project_id);
  redirectToQuote(created.id);
  return { ok: true, quoteId: created.id };
}

export async function sendQuoteToClient(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const quoteId = asString(formData.get("quoteId"));

  if (!quoteId) {
    return { ok: false, error: "Missing quote." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", quoteId)
    .maybeSingle();

  if (quoteError) {
    return { ok: false, error: quoteError.message };
  }
  if (!quote) {
    return { ok: false, error: "Quote not found." };
  }
  if (!canSendQuote(quote.status)) {
    return { ok: false, error: "Only draft quotes can be sent." };
  }

  const { data: items, error: itemsError } = await supabase
    .from("quote_items")
    .select("id")
    .eq("quote_id", quoteId)
    .limit(1);

  if (itemsError) {
    return { ok: false, error: itemsError.message };
  }
  if (!items || items.length === 0) {
    return { ok: false, error: "Add line items before sending this quote." };
  }

  const sentAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("quotes")
    .update({
      status: "sent",
      sent_at: sentAt,
    })
    .eq("id", quoteId)
    .eq("status", "draft");

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, client_id")
    .eq("id", quote.project_id)
    .maybeSingle();

  if (project?.client_id) {
    await supabase.from("project_messages").insert({
      project_id: quote.project_id,
      sender_id: admin.id,
      message: `Quote version ${quote.version} has been sent for review.`,
      is_read: false,
    });
  }

  await writeAuditLog({
    actorId: admin.id,
    action: "quote.sent",
    entityId: quoteId,
    oldData: { status: quote.status },
    newData: { status: "sent", sent_at: sentAt },
  });

  revalidateQuotes(quoteId, quote.project_id);
  return { ok: true, quoteId };
}

export async function updateQuoteStatus(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const quoteId = asString(formData.get("quoteId"));
  const statusRaw = asString(formData.get("status"));

  if (!quoteId) {
    return { ok: false, error: "Missing quote." };
  }
  if (!isQuoteStatus(statusRaw)) {
    return { ok: false, error: "Invalid quote status." };
  }

  const nextStatus = statusRaw as QuoteStatus;
  const supabase = await createServerSupabaseClient();
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", quoteId)
    .maybeSingle();

  if (quoteError) {
    return { ok: false, error: quoteError.message };
  }
  if (!quote) {
    return { ok: false, error: "Quote not found." };
  }

  const allowed = getAllowedQuoteTransitions(quote.status);
  if (!allowed.includes(nextStatus)) {
    return {
      ok: false,
      error: `Cannot change status from ${quote.status} to ${nextStatus}.`,
    };
  }

  const patch: Partial<QuoteRow> = { status: nextStatus };
  const now = new Date().toISOString();

  if (nextStatus === "sent" && !quote.sent_at) {
    patch.sent_at = now;
  }
  if (nextStatus === "accepted") {
    patch.accepted_at = now;
  }
  if (nextStatus === "rejected") {
    patch.rejected_at = now;
  }

  const { error: updateError } = await supabase
    .from("quotes")
    .update(patch)
    .eq("id", quoteId)
    .eq("status", quote.status);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  await writeAuditLog({
    actorId: admin.id,
    action: "quote.status_updated",
    entityId: quoteId,
    oldData: { status: quote.status },
    newData: { status: nextStatus },
  });

  revalidateQuotes(quoteId, quote.project_id);
  return { ok: true, quoteId };
}
