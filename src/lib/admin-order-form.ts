import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  type AdminOrderFormField,
  type AdminOrderFormOption,
  type AdminOrderFormStep,
  type AdminOrderFormTree,
  type QueryResult,
} from "@/lib/admin-order-form-constants";
import type {
  OrderFormFieldRow,
  OrderFormOptionRow,
  OrderFormStepRow,
} from "@/types/database";

export * from "@/lib/admin-order-form-constants";

function isMissingRelation(error: { message?: string; code?: string } | null): boolean {
  if (!error) {
    return false;
  }

  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.code === "PGRST200" ||
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find the table") ||
    message.includes("could not find a relationship")
  );
}

function toQueryResult<T>(
  data: T,
  error: { message?: string; code?: string } | null,
  table: string,
  isEmpty: boolean,
): QueryResult<T> {
  if (error) {
    if (isMissingRelation(error)) {
      return {
        status: "unavailable",
        message: `${table} is not available in the current database schema.`,
      };
    }
    return { status: "error", message: error.message ?? "Unknown error" };
  }

  return isEmpty ? { status: "empty", data } : { status: "ok", data };
}

export async function getAdminOrderFormTree(): Promise<QueryResult<AdminOrderFormTree>> {
  const supabase = await createServerSupabaseClient();

  const [stepsResult, fieldsResult, optionsResult] = await Promise.all([
    supabase
      .from("order_form_steps")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .from("order_form_fields")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .from("order_form_options")
      .select("*")
      .order("group", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
  ]);

  const error = stepsResult.error ?? fieldsResult.error ?? optionsResult.error;
  if (error) {
    return toQueryResult(
      { steps: [], ungroupedOptions: [] },
      error,
      "order_form_steps",
      true,
    );
  }

  const steps = (stepsResult.data ?? []) as OrderFormStepRow[];
  const fields = (fieldsResult.data ?? []) as OrderFormFieldRow[];
  const options = (optionsResult.data ?? []) as OrderFormOptionRow[];

  const optionsByGroup = new Map<string, AdminOrderFormOption[]>();
  for (const option of options) {
    const list = optionsByGroup.get(option.group) ?? [];
    list.push(option);
    optionsByGroup.set(option.group, list);
  }

  const usedGroups = new Set<string>();
  const fieldsByStep = new Map<string, AdminOrderFormField[]>();
  for (const field of fields) {
    const fieldOptions =
      field.options_group && optionsByGroup.has(field.options_group)
        ? (optionsByGroup.get(field.options_group) ?? [])
        : [];
    if (field.options_group) {
      usedGroups.add(field.options_group);
    }
    const list = fieldsByStep.get(field.step_id) ?? [];
    list.push({ ...field, options: fieldOptions });
    fieldsByStep.set(field.step_id, list);
  }

  const treeSteps: AdminOrderFormStep[] = steps.map((step) => ({
    ...step,
    fields: fieldsByStep.get(step.id) ?? [],
  }));

  const ungroupedOptions = options.filter((option) => !usedGroups.has(option.group));

  const isEmpty = treeSteps.length === 0 && options.length === 0;
  return toQueryResult(
    { steps: treeSteps, ungroupedOptions },
    null,
    "order_form_steps",
    isEmpty,
  );
}
