"use server";

import { revalidatePath } from "next/cache";
import {
  isOrderFormInputType,
  isSelectableInputType,
  isValidFormKey,
  keyify,
  uniqueErrorMessage,
} from "@/lib/admin-order-form-constants";
import { requireAdmin } from "@/lib/require-admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

type ActionResult = { ok: true } | { ok: false; error: string };

type SortableRow = { id: string; sort_order: number };

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalString(value: FormDataEntryValue | null): string | null {
  const next = asString(value);
  return next ? next : null;
}

function asCheckbox(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true";
}

function revalidateOrderForm() {
  revalidatePath("/admin/request-form");
  revalidatePath("/start-project");
  revalidatePath("/profile/project-requests");
}

async function nextSortOrder(scope: {
  table: "order_form_steps";
} | {
  table: "order_form_fields";
  stepId: string;
} | {
  table: "order_form_options";
  group: string;
}): Promise<number> {
  const supabase = await createServerSupabaseClient();
  const query =
    scope.table === "order_form_steps"
      ? supabase.from("order_form_steps").select("sort_order")
      : scope.table === "order_form_fields"
        ? supabase.from("order_form_fields").select("sort_order").eq("step_id", scope.stepId)
        : supabase.from("order_form_options").select("sort_order").eq("group", scope.group);
  const { data } = await query.order("sort_order", { ascending: false }).limit(1);
  const current = (data ?? []) as Array<{ sort_order: number }>;
  return (current[0]?.sort_order ?? -1) + 1;
}

async function swapSortOrder(
  table: "order_form_steps" | "order_form_fields" | "order_form_options",
  rows: SortableRow[],
  id: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  const index = rows.findIndex((row) => row.id === id);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapIndex < 0 || swapIndex >= rows.length) {
    return { ok: true };
  }

  const current = rows[index];
  const neighbor = rows[swapIndex];
  const first = await supabase.from(table).update({ sort_order: neighbor.sort_order }).eq("id", current.id);
  if (first.error) {
    return { ok: false, error: first.error.message };
  }
  const second = await supabase.from(table).update({ sort_order: current.sort_order }).eq("id", neighbor.id);
  if (second.error) {
    return { ok: false, error: second.error.message };
  }
  return { ok: true };
}

function parseJsonObject(raw: string, label: string): { ok: true; value: Json } | { ok: false; error: string } {
  if (!raw) {
    return { ok: true, value: {} };
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: `${label} must be a JSON object.` };
    }
    return { ok: true, value: parsed as Json };
  } catch {
    return { ok: false, error: `${label} must be valid JSON.` };
  }
}

function parseDefaultValue(raw: string): { ok: true; value: Json | null } | { ok: false; error: string } {
  if (!raw) {
    return { ok: true, value: null };
  }
  try {
    return { ok: true, value: JSON.parse(raw) as Json };
  } catch {
    return { ok: true, value: raw };
  }
}

export async function saveOrderFormStep(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const id = asOptionalString(formData.get("id"));
  const title = asString(formData.get("title"));
  const description = asOptionalString(formData.get("description"));
  const stepKeyRaw = asString(formData.get("step_key"));
  const stepKey = stepKeyRaw ? keyify(stepKeyRaw) : keyify(title);
  const isActive = id ? asCheckbox(formData.get("is_active")) : true;

  if (!title) {
    return { ok: false, error: "Step title is required." };
  }
  if (!isValidFormKey(stepKey)) {
    return {
      ok: false,
      error: "Step key must start with a letter and use lowercase letters, numbers, or underscores.",
    };
  }

  const supabase = await createServerSupabaseClient();
  const payload = {
    title,
    description,
    step_key: stepKey,
    is_active: isActive,
    ...(id ? {} : { sort_order: await nextSortOrder({ table: "order_form_steps" }) }),
  };

  const { error } = id
    ? await supabase.from("order_form_steps").update(payload).eq("id", id)
    : await supabase.from("order_form_steps").insert(payload);

  if (error) {
    return {
      ok: false,
      error: uniqueErrorMessage(error.message, "That step key is already in use."),
    };
  }

  revalidateOrderForm();
  return { ok: true };
}

export async function setOrderFormStepActive(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = asString(formData.get("stepId"));
  const valueRaw = asString(formData.get("value"));
  if (!id || (valueRaw !== "true" && valueRaw !== "false")) {
    return { ok: false, error: "Invalid step visibility request." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("order_form_steps")
    .update({ is_active: valueRaw === "true" })
    .eq("id", id);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateOrderForm();
  return { ok: true };
}

export async function reorderOrderFormStep(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = asString(formData.get("stepId"));
  const direction = asString(formData.get("direction"));
  if (!id || (direction !== "up" && direction !== "down")) {
    return { ok: false, error: "Invalid reorder request." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("order_form_steps")
    .select("id, sort_order")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (error) {
    return { ok: false, error: error.message };
  }

  const result = await swapSortOrder(
    "order_form_steps",
    (data ?? []) as SortableRow[],
    id,
    direction,
  );
  if (!result.ok) {
    return result;
  }
  revalidateOrderForm();
  return { ok: true };
}

export async function deleteOrderFormStep(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = asString(formData.get("stepId"));
  if (!id) {
    return { ok: false, error: "Missing step." };
  }

  const supabase = await createServerSupabaseClient();
  const { count, error: countError } = await supabase
    .from("order_form_fields")
    .select("id", { count: "exact", head: true })
    .eq("step_id", id);
  if (countError) {
    return { ok: false, error: countError.message };
  }
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: "Hide this step instead, or delete its fields first. Existing requests keep their snapshots.",
    };
  }

  const { error } = await supabase.from("order_form_steps").delete().eq("id", id);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateOrderForm();
  return { ok: true };
}

export async function saveOrderFormField(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const id = asOptionalString(formData.get("id"));
  const stepId = asString(formData.get("step_id"));
  const label = asString(formData.get("label"));
  const fieldKeyRaw = asString(formData.get("field_key"));
  const fieldKey = fieldKeyRaw ? keyify(fieldKeyRaw) : keyify(label);
  const inputType = asString(formData.get("input_type"));
  const hint = asOptionalString(formData.get("hint"));
  const placeholder = asOptionalString(formData.get("placeholder"));
  const optionsGroupRaw = asOptionalString(formData.get("options_group"));
  const required = asCheckbox(formData.get("required"));
  const visible = id ? asCheckbox(formData.get("visible")) : true;
  const isActive = id ? asCheckbox(formData.get("is_active")) : true;
  const conditionalRaw = asString(formData.get("conditional"));
  const constraintsRaw = asString(formData.get("constraints"));
  const defaultValueRaw = asString(formData.get("default_value"));

  if (!stepId) {
    return { ok: false, error: "Choose a step for this field." };
  }
  if (!label) {
    return { ok: false, error: "Field label is required." };
  }
  if (!isValidFormKey(fieldKey)) {
    return {
      ok: false,
      error: "Field key must start with a letter and use lowercase letters, numbers, or underscores.",
    };
  }
  if (!isOrderFormInputType(inputType)) {
    return { ok: false, error: "Unsupported field type." };
  }

  const selectable = isSelectableInputType(inputType);
  const optionsGroup = selectable && optionsGroupRaw ? keyify(optionsGroupRaw) : null;
  if (selectable && optionsGroupRaw && !isValidFormKey(optionsGroup ?? "")) {
    return {
      ok: false,
      error: "Options group must start with a letter and use lowercase letters, numbers, or underscores.",
    };
  }

  const conditional = parseJsonObject(conditionalRaw, "Conditional logic");
  if (!conditional.ok) {
    return conditional;
  }
  const constraints = parseJsonObject(constraintsRaw, "Constraints");
  if (!constraints.ok) {
    return constraints;
  }
  const defaultValue = parseDefaultValue(defaultValueRaw);
  if (!defaultValue.ok) {
    return defaultValue;
  }

  const supabase = await createServerSupabaseClient();
  const payload = {
    step_id: stepId,
    label,
    field_key: fieldKey,
    input_type: inputType,
    hint,
    placeholder: placeholder && (inputType === "text" || inputType === "email" || inputType === "tel" || inputType === "textarea" || inputType === "date" || inputType === "select")
      ? placeholder
      : null,
    options_group: optionsGroup,
    required,
    visible,
    is_active: isActive,
    conditional: conditional.value,
    constraints: constraints.value,
    default_value: defaultValue.value,
    ...(id ? {} : { sort_order: await nextSortOrder({ table: "order_form_fields", stepId }) }),
  };

  const { error } = id
    ? await supabase.from("order_form_fields").update(payload).eq("id", id)
    : await supabase.from("order_form_fields").insert(payload);

  if (error) {
    return {
      ok: false,
      error: uniqueErrorMessage(error.message, "That field key is already in use."),
    };
  }

  revalidateOrderForm();
  return { ok: true };
}

export async function setOrderFormFieldActive(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = asString(formData.get("fieldId"));
  const valueRaw = asString(formData.get("value"));
  if (!id || (valueRaw !== "true" && valueRaw !== "false")) {
    return { ok: false, error: "Invalid field visibility request." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("order_form_fields")
    .update({ is_active: valueRaw === "true" })
    .eq("id", id);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateOrderForm();
  return { ok: true };
}

export async function reorderOrderFormField(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = asString(formData.get("fieldId"));
  const stepId = asString(formData.get("stepId"));
  const direction = asString(formData.get("direction"));
  if (!id || !stepId || (direction !== "up" && direction !== "down")) {
    return { ok: false, error: "Invalid reorder request." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("order_form_fields")
    .select("id, sort_order")
    .eq("step_id", stepId)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (error) {
    return { ok: false, error: error.message };
  }

  const result = await swapSortOrder(
    "order_form_fields",
    (data ?? []) as SortableRow[],
    id,
    direction,
  );
  if (!result.ok) {
    return result;
  }
  revalidateOrderForm();
  return { ok: true };
}

export async function deleteOrderFormField(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = asString(formData.get("fieldId"));
  if (!id) {
    return { ok: false, error: "Missing field." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("order_form_fields").delete().eq("id", id);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateOrderForm();
  return { ok: true };
}

export async function saveOrderFormOption(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const id = asOptionalString(formData.get("id"));
  const groupRaw = asString(formData.get("group"));
  const group = keyify(groupRaw);
  const label = asString(formData.get("label"));
  const slugRaw = asString(formData.get("slug"));
  const slug = slugRaw ? keyify(slugRaw) : keyify(label);
  const description = asOptionalString(formData.get("description"));
  const requiresText = asCheckbox(formData.get("requires_text"));
  const isActive = id ? asCheckbox(formData.get("is_active")) : true;
  const metaRaw = asString(formData.get("meta"));

  if (!label) {
    return { ok: false, error: "Option label is required." };
  }
  if (!isValidFormKey(group)) {
    return {
      ok: false,
      error: "Options group must start with a letter and use lowercase letters, numbers, or underscores.",
    };
  }
  if (!isValidFormKey(slug)) {
    return {
      ok: false,
      error: "Option value must start with a letter and use lowercase letters, numbers, or underscores.",
    };
  }

  const meta = parseJsonObject(metaRaw, "Option meta");
  if (!meta.ok) {
    return meta;
  }

  const supabase = await createServerSupabaseClient();
  const payload = {
    group,
    slug,
    label,
    description,
    requires_text: requiresText,
    is_active: isActive,
    meta: meta.value,
    ...(id ? {} : { sort_order: await nextSortOrder({ table: "order_form_options", group }) }),
  };

  const { error } = id
    ? await supabase.from("order_form_options").update(payload).eq("id", id)
    : await supabase.from("order_form_options").insert(payload);

  if (error) {
    return {
      ok: false,
      error: uniqueErrorMessage(error.message, "That option value already exists in this group."),
    };
  }

  await supabase
    .from("order_form_fields")
    .update({ options_group: group })
    .eq("field_key", group)
    .is("options_group", null);

  revalidateOrderForm();
  return { ok: true };
}

export async function setOrderFormOptionActive(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = asString(formData.get("optionId"));
  const valueRaw = asString(formData.get("value"));
  if (!id || (valueRaw !== "true" && valueRaw !== "false")) {
    return { ok: false, error: "Invalid option visibility request." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("order_form_options")
    .update({ is_active: valueRaw === "true" })
    .eq("id", id);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateOrderForm();
  return { ok: true };
}

export async function reorderOrderFormOption(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = asString(formData.get("optionId"));
  const group = asString(formData.get("group"));
  const direction = asString(formData.get("direction"));
  if (!id || !group || (direction !== "up" && direction !== "down")) {
    return { ok: false, error: "Invalid reorder request." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("order_form_options")
    .select("id, sort_order")
    .eq("group", group)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (error) {
    return { ok: false, error: error.message };
  }

  const result = await swapSortOrder(
    "order_form_options",
    (data ?? []) as SortableRow[],
    id,
    direction,
  );
  if (!result.ok) {
    return result;
  }
  revalidateOrderForm();
  return { ok: true };
}

export async function deleteOrderFormOption(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = asString(formData.get("optionId"));
  if (!id) {
    return { ok: false, error: "Missing option." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("order_form_options").delete().eq("id", id);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateOrderForm();
  return { ok: true };
}
