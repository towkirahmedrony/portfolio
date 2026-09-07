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
  quoteFromRequestBlockedReason,
} from "@/lib/admin-quote-constants";
import {
  assertMatchingTotals,
  calculateQuoteFinancials,
  parseNumeric,
  roundMoney,
  toPostgresNumeric,
  type QuoteLineInput,
} from "@/lib/quote-money";
import { formatRequestBudget, formatRequestDeadline } from "@/lib/admin-project-request-constants";
import type {
  Json,
  ProjectRequestRow,
  QuoteItemRow,
  QuoteRow,
  QuoteStatus,
} from "@/types/database";

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

function revalidateQuotes(quoteId?: string, projectId?: string | null, requestId?: string | null) {
  revalidatePath("/admin");
  revalidatePath("/admin/quotes");
  revalidatePath("/admin/project-requests");
  revalidatePath("/profile", "layout");
  if (quoteId) {
    revalidatePath(`/admin/quotes/${quoteId}`);
  }
  if (projectId) {
    revalidatePath(`/admin/projects/${projectId}`);
    revalidatePath(`/profile/projects/${projectId}`);
  }
  if (requestId) {
    revalidatePath(`/admin/project-requests/${requestId}`);
    revalidatePath(`/profile/project-requests/${requestId}`);
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
      old_data: (input.oldData ?? null) as Json,
      new_data: (input.newData ?? null) as Json,
    });
  } catch {
    // Audit logging is best-effort and must not block quote workflows.
  }
}

function currencyFromSource(sourceCurrency: string | null | undefined, fallback: string) {
  const currency = sourceCurrency?.trim() || fallback.trim() || "BDT";
  if (!currency) {
    throw new Error("Currency is required.");
  }
  return currency;
}

async function nextQuoteVersionForRequest(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  requestId: string | null,
  projectId: string | null,
): Promise<{ ok: true; version: number } | { ok: false; error: string }> {
  let query = supabase.from("quotes").select("version").order("version", { ascending: false }).limit(1);
  if (requestId) {
    query = query.eq("project_request_id", requestId);
  } else if (projectId) {
    query = query.eq("project_id", projectId);
  } else {
    return { ok: true, version: 1 };
  }

  const { data, error } = await query;
  if (error) {
    return { ok: false, error: error.message };
  }
  const version = data && data.length > 0 ? Number(data[0].version ?? 0) + 1 : 1;
  return { ok: true, version };
}

async function markRequestQuoted(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  requestId: string | null | undefined,
) {
  if (!requestId) {
    return;
  }
  await supabase
    .from("project_requests")
    .update({ status: "quoted" })
    .eq("id", requestId)
    .in("status", ["new", "reviewing", "quoted", "approved"]);
}

export async function saveQuoteDraft(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const quoteId = asOptionalString(formData.get("quoteId"));
  const requestIdInput = asString(formData.get("requestId"));
  const notes = asOptionalString(formData.get("notes"));
  const terms = asOptionalString(formData.get("terms"));

  if (!quoteId && !requestIdInput) {
    return { ok: false, error: "Select a project request." };
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
    if (!canEditQuote(existing.status)) {
      return { ok: false, error: "Only draft quotes can be edited. Create a new version instead." };
    }

    const { error: updateError } = await supabase
      .from("quotes")
      .update({
        notes,
        terms,
        valid_until: validUntil,
        currency: existing.currency || currencyFromSource(existing.currency, "BDT"),
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

    revalidateQuotes(quoteId, existing.project_id, existing.project_request_id);
    return { ok: true, quoteId };
  }

  const { data: request, error: requestError } = await supabase
    .from("project_requests")
    .select("id, client_id, status, budget_currency")
    .eq("id", requestIdInput)
    .maybeSingle();

  if (requestError) {
    return { ok: false, error: requestError.message };
  }
  if (!request) {
    return { ok: false, error: "Project request not found." };
  }

  const blocked = quoteFromRequestBlockedReason(
    request.status,
    Boolean(request.client_id),
    false,
  );
  if (blocked) {
    return { ok: false, error: blocked };
  }

  const { data: linkedProject } = await supabase
    .from("projects")
    .select("id")
    .eq("request_id", request.id)
    .maybeSingle();

  const versionResult = await nextQuoteVersionForRequest(supabase, request.id, linkedProject?.id ?? null);
  if (!versionResult.ok) {
    return versionResult;
  }

  const currency = currencyFromSource(request.budget_currency, "BDT");

  const { data: created, error: insertError } = await supabase
    .from("quotes")
    .insert({
      project_id: linkedProject?.id ?? null,
      project_request_id: request.id,
      version: versionResult.version,
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
    newData: { version: versionResult.version, request_id: request.id, ...totals },
  });

  revalidateQuotes(created.id, linkedProject?.id ?? null, request.id);
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

  const versionResult = await nextQuoteVersionForRequest(
    supabase,
    source.project_request_id,
    source.project_id,
  );
  if (!versionResult.ok) {
    return versionResult;
  }

  const { data: created, error: insertError } = await supabase
    .from("quotes")
    .insert({
      project_id: source.project_id,
      project_request_id: source.project_request_id,
      version: versionResult.version,
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
    newData: { version: versionResult.version },
  });

  revalidateQuotes(created.id, source.project_id, source.project_request_id);
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

  if (quote.project_id) {
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
  }

  await markRequestQuoted(supabase, quote.project_request_id);

  await writeAuditLog({
    actorId: admin.id,
    action: "quote.sent",
    entityId: quoteId,
    oldData: { status: quote.status },
    newData: { status: "sent", sent_at: sentAt },
  });

  revalidateQuotes(quoteId, quote.project_id, quote.project_request_id);
  return { ok: true, quoteId };
}

function slugText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/_/g, " ") : null;
}

/**
 * Assembles an editable notes block for a quote draft created from a project
 * request. Everything here is advisory copy — the admin edits notes before the
 * quote is sent, exactly like any other quote field.
 */
function buildQuoteDraftNotes(
  request: ProjectRequestRow,
  serviceName: string | null,
): string | null {
  const lines: string[] = [];
  lines.push(`Request: ${request.request_number}`);

  const service = serviceName?.trim();
  if (service) {
    lines.push(`Service: ${service}`);
  }

  const projectType = slugText(request.project_type);
  if (projectType) {
    lines.push(`Project type: ${projectType}`);
  }

  const budget = formatRequestBudget(
    request.budget_min,
    request.budget_max,
    request.budget_currency || "BDT",
  );
  lines.push(`Submitted budget: ${budget}`);

  const deadline = formatRequestDeadline(request.deadline_date, request.deadline_type);
  if (deadline && deadline !== "—") {
    lines.push(`Requested deadline: ${deadline}`);
  }

  if (request.page_count != null) {
    lines.push(`Page count: ${request.page_count}`);
  }
  const websiteStatus = slugText(request.website_status);
  if (websiteStatus) {
    lines.push(`Website status: ${websiteStatus}`);
  }
  if (request.company_name?.trim()) {
    lines.push(`Company: ${request.company_name.trim()}`);
  }
  if (request.phone?.trim()) {
    lines.push(`Phone: ${request.phone.trim()}`);
  }

  const features = (request.required_features ?? [])
    .map((feature) => slugText(feature))
    .filter((feature): feature is string => Boolean(feature));
  if (features.length > 0) {
    lines.push(`Requirements: ${features.join(", ")}`);
  }

  const design: string[] = [];
  if (request.has_design) {
    design.push("client has an existing design");
  }
  const designStyle = slugText(request.design_style);
  if (designStyle) {
    design.push(`style: ${designStyle}`);
  }
  if (request.has_logo) {
    design.push("logo available");
  }
  if (request.brand_colors?.trim()) {
    design.push(`brand colors: ${request.brand_colors.trim()}`);
  }
  if (design.length > 0) {
    lines.push(`Design: ${design.join(" · ")}`);
  }
  if (request.figma_url?.trim()) {
    lines.push(`Figma: ${request.figma_url.trim()}`);
  }

  const references = (request.reference_urls ?? []).filter((url) => url.trim());
  if (references.length > 0) {
    lines.push(`References: ${references.join(", ")}`);
  }

  const description = request.description?.trim();
  if (description) {
    lines.push("", "Description:", description);
  }

  const notes = lines.join("\n").trim();
  return notes || null;
}

/**
 * Creates a quote DRAFT from a project request. No project is created.
 * The submitted budget is only a suggested starting amount.
 */
export async function createQuoteDraftFromRequest(
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const requestId = asString(formData.get("requestId"));

  if (!requestId) {
    return { ok: false, error: "Missing project request." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: request, error: requestError } = await supabase
    .from("project_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (requestError) {
    return { ok: false, error: requestError.message };
  }
  if (!request) {
    return { ok: false, error: "Project request not found." };
  }

  const requestRow = request as ProjectRequestRow;
  const blocked = quoteFromRequestBlockedReason(
    requestRow.status,
    Boolean(requestRow.client_id),
    false,
  );
  if (blocked) {
    return { ok: false, error: blocked };
  }

  const { data: linkedProjects, error: linkedError } = await supabase
    .from("projects")
    .select("id, title, currency")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (linkedError) {
    return { ok: false, error: linkedError.message };
  }

  const linkedProject = linkedProjects?.[0] ?? null;

  let serviceName: string | null = null;
  if (requestRow.service_id) {
    const { data: service } = await supabase
      .from("services")
      .select("name")
      .eq("id", requestRow.service_id)
      .maybeSingle();
    serviceName = service?.name ?? null;
  }

  const suggestedAmount = roundMoney(
    Number(requestRow.budget_max ?? requestRow.budget_min ?? 0) || 0,
  );
  const currency =
    requestRow.budget_currency?.trim() || linkedProject?.currency?.trim() || "BDT";
  const title =
    linkedProject?.title?.trim() ||
    serviceName?.trim() ||
    requestRow.project_type?.trim() ||
    `Project ${requestRow.request_number}`;

  const lineItems: QuoteLineInput[] = [
    {
      description: title,
      quantity: 1,
      unit_price: suggestedAmount,
    },
  ];
  const calculated = calculateQuoteFinancials(lineItems, 0, 0);
  if (!calculated.ok) {
    return { ok: false, error: calculated.error };
  }

  const totals = {
    subtotal: toPostgresNumeric(calculated.totals.subtotal),
    discount_total: toPostgresNumeric(calculated.totals.discount_total),
    tax_total: toPostgresNumeric(calculated.totals.tax_total),
    total: toPostgresNumeric(calculated.totals.total),
  };

  const notes = buildQuoteDraftNotes(requestRow, serviceName);
  const versionResult = await nextQuoteVersionForRequest(
    supabase,
    requestId,
    linkedProject?.id ?? null,
  );
  if (!versionResult.ok) {
    return versionResult;
  }

  const { data: created, error: insertError } = await supabase
    .from("quotes")
    .insert({
      project_id: linkedProject?.id ?? null,
      project_request_id: requestId,
      version: versionResult.version,
      currency,
      notes,
      terms: null,
      valid_until: null,
      status: "draft",
      ...totals,
    })
    .select("id")
    .single();

  if (insertError || !created) {
    return { ok: false, error: insertError?.message ?? "Could not create the quote draft." };
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
    action: "quote.created_from_request",
    entityId: created.id,
    oldData: {
      request_id: requestId,
      request_status: requestRow.status,
      requested_budget_max: requestRow.budget_max,
      requested_budget_min: requestRow.budget_min,
    },
    newData: { version: versionResult.version, request_id: requestId, ...totals },
  });

  revalidateQuotes(created.id, linkedProject?.id ?? null, requestId);
  redirectToQuote(created.id);
  return { ok: true, quoteId: created.id };
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
  if (nextStatus === "accepted") {
    return {
      ok: false,
      error: "The client accepts the quote. That is the only path that creates a project.",
    };
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

  if (nextStatus === "sent") {
    await markRequestQuoted(supabase, quote.project_request_id);
  }

  await writeAuditLog({
    actorId: admin.id,
    action: "quote.status_updated",
    entityId: quoteId,
    oldData: { status: quote.status },
    newData: { status: nextStatus },
  });

  revalidateQuotes(quoteId, quote.project_id, quote.project_request_id);
  return { ok: true, quoteId };
}
