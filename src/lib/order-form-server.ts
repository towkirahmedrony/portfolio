import { createPublicSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { PublicContentResult } from "@/lib/public-content";
import { buildOrderFormConfig } from "@/lib/order-form";
import type {
  OrderFormFieldRow,
  OrderFormOptionRow,
  OrderFormStepRow,
} from "@/types/database";
import type { OrderFormConfig } from "@/types/project-request";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    message.includes("could not find a relationship") ||
    message.includes("permission denied")
  );
}

export async function getOrderFormConfig(): Promise<
  PublicContentResult<OrderFormConfig>
> {
  if (!isSupabaseConfigured()) {
    return { status: "unavailable" };
  }

  try {
    const supabase = createPublicSupabaseClient();

    const [stepsResult, fieldsResult, optionsResult] = await Promise.all([
      supabase
        .from("order_form_steps")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true }),
      supabase
        .from("order_form_fields")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true }),
      supabase
        .from("order_form_options")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true }),
    ]);

    const error = stepsResult.error ?? fieldsResult.error ?? optionsResult.error;
    if (error) {
      return isMissingRelation(error)
        ? { status: "unavailable" }
        : { status: "error" };
    }

    const steps = (stepsResult.data ?? []) as OrderFormStepRow[];
    const fields = (fieldsResult.data ?? []) as OrderFormFieldRow[];
    const options = (optionsResult.data ?? []) as OrderFormOptionRow[];

    if (steps.length === 0) {
      return { status: "empty" };
    }

    const activeStepIds = new Set(steps.map((step) => step.id));
    const config = buildOrderFormConfig(
      steps,
      fields.filter((field) => activeStepIds.has(field.step_id)),
      options,
    );

    if (
      config.steps.every((step) => step.fields.length === 0) &&
      !config.steps.some((step) => step.isReview)
    ) {
      return { status: "empty" };
    }

    return { status: "ok", data: config };
  } catch {
    return { status: "unavailable" };
  }
}

export async function resolveServiceId(
  serviceParam: string | null,
): Promise<string | null> {
  if (!serviceParam || !isSupabaseConfigured()) {
    return null;
  }

  try {
    const supabase = createPublicSupabaseClient();
    const isUuid = UUID_PATTERN.test(serviceParam);

    const query = supabase
      .from("services")
      .select("id")
      .eq("published", true)
      .limit(1);

    const { data, error } = isUuid
      ? await query.eq("id", serviceParam).maybeSingle()
      : await query.eq("slug", serviceParam).maybeSingle();

    if (error || !data) {
      return null;
    }

    return data.id;
  } catch {
    return null;
  }
}
