"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { parseKeywordsInput } from "@/lib/admin-ai-constants";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { ok: false; error: string };

const AI_PATH = "/admin/ai";

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

function parsePriority(value: FormDataEntryValue | null): number | null {
  const raw = asString(value);
  if (!raw) {
    return 0;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return null;
  }
  return parsed;
}

function revalidateAiAdmin() {
  revalidatePath(AI_PATH);
}

export async function saveAiKnowledge(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const id = asOptionalString(formData.get("id"));
  const title = asString(formData.get("title"));
  const content = asString(formData.get("content"));
  const category = asOptionalString(formData.get("category"));
  const priority = parsePriority(formData.get("priority"));
  const isActive = asCheckbox(formData.get("is_active"));

  if (!title) {
    return { ok: false, error: "Title is required." };
  }
  if (!content) {
    return { ok: false, error: "Content is required." };
  }
  if (priority == null) {
    return { ok: false, error: "Priority must be a whole number." };
  }

  const supabase = await createServerSupabaseClient();
  const payload = {
    title,
    content,
    category,
    priority,
    is_active: isActive,
    updated_at: new Date().toISOString(),
  };

  const { error } = id
    ? await supabase.from("ai_knowledge").update(payload).eq("id", id)
    : await supabase.from("ai_knowledge").insert(payload);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateAiAdmin();
  return { ok: true };
}

export async function setAiKnowledgeActive(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = asString(formData.get("id"));
  if (!id) {
    return { ok: false, error: "Missing knowledge item." };
  }
  const isActive = asCheckbox(formData.get("value"));
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("ai_knowledge")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    return { ok: false, error: error.message };
  }
  revalidateAiAdmin();
  return { ok: true };
}

export async function deleteAiKnowledge(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = asString(formData.get("id"));
  if (!id) {
    return { ok: false, error: "Missing knowledge item." };
  }
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("ai_knowledge").delete().eq("id", id);
  if (error) {
    return { ok: false, error: error.message };
  }
  revalidateAiAdmin();
  return { ok: true };
}

export async function saveAiRule(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const id = asOptionalString(formData.get("id"));
  const name = asString(formData.get("name"));
  const ruleType = asString(formData.get("rule_type"));
  const instruction = asString(formData.get("instruction"));
  const priority = parsePriority(formData.get("priority"));
  const isActive = asCheckbox(formData.get("is_active"));

  if (!name) {
    return { ok: false, error: "Rule name is required." };
  }
  if (!ruleType) {
    return { ok: false, error: "Rule type is required." };
  }
  if (!instruction) {
    return { ok: false, error: "Instruction is required." };
  }
  if (priority == null) {
    return { ok: false, error: "Priority must be a whole number." };
  }

  const supabase = await createServerSupabaseClient();
  const payload = {
    name,
    rule_type: ruleType,
    instruction,
    priority,
    is_active: isActive,
    updated_at: new Date().toISOString(),
  };

  const { error } = id
    ? await supabase.from("ai_rules").update(payload).eq("id", id)
    : await supabase.from("ai_rules").insert(payload);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateAiAdmin();
  return { ok: true };
}

export async function setAiRuleActive(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = asString(formData.get("id"));
  if (!id) {
    return { ok: false, error: "Missing rule." };
  }
  const isActive = asCheckbox(formData.get("value"));
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("ai_rules")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    return { ok: false, error: error.message };
  }
  revalidateAiAdmin();
  return { ok: true };
}

export async function deleteAiRule(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = asString(formData.get("id"));
  if (!id) {
    return { ok: false, error: "Missing rule." };
  }
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("ai_rules").delete().eq("id", id);
  if (error) {
    return { ok: false, error: error.message };
  }
  revalidateAiAdmin();
  return { ok: true };
}

export async function saveAiFaq(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const id = asOptionalString(formData.get("id"));
  const question = asString(formData.get("question"));
  const answer = asString(formData.get("answer"));
  const category = asOptionalString(formData.get("category"));
  const keywords = parseKeywordsInput(asString(formData.get("keywords")));
  const priority = parsePriority(formData.get("priority"));
  const isActive = asCheckbox(formData.get("is_active"));

  if (!question) {
    return { ok: false, error: "Question is required." };
  }
  if (!answer) {
    return { ok: false, error: "Answer is required." };
  }
  if (priority == null) {
    return { ok: false, error: "Priority must be a whole number." };
  }

  const supabase = await createServerSupabaseClient();
  const payload = {
    question,
    answer,
    category,
    keywords: keywords.length > 0 ? keywords : null,
    priority,
    is_active: isActive,
    updated_at: new Date().toISOString(),
  };

  const { error } = id
    ? await supabase.from("ai_faqs").update(payload).eq("id", id)
    : await supabase.from("ai_faqs").insert(payload);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateAiAdmin();
  return { ok: true };
}

export async function setAiFaqActive(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = asString(formData.get("id"));
  if (!id) {
    return { ok: false, error: "Missing FAQ." };
  }
  const isActive = asCheckbox(formData.get("value"));
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("ai_faqs")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    return { ok: false, error: error.message };
  }
  revalidateAiAdmin();
  return { ok: true };
}

export async function deleteAiFaq(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = asString(formData.get("id"));
  if (!id) {
    return { ok: false, error: "Missing FAQ." };
  }
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("ai_faqs").delete().eq("id", id);
  if (error) {
    return { ok: false, error: error.message };
  }
  revalidateAiAdmin();
  return { ok: true };
}

export async function saveAiSettings(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("ai_settings")
    .select("id, setting_key, setting_value, is_active");

  if (error) {
    return { ok: false, error: error.message };
  }

  const rows = (data ?? []) as {
    id: string;
    setting_key: string;
    setting_value: string | null;
    is_active: boolean;
  }[];

  const now = new Date().toISOString();
  for (const row of rows) {
    const activeKey = `active_${row.id}`;
    const valueKey = `value_${row.id}`;
    const nextActive = asCheckbox(formData.get(activeKey));
    const rawValues = formData.getAll(valueKey);
    const nextValue =
      rawValues.length > 1
        ? rawValues.includes("true")
          ? "true"
          : "false"
        : asString(formData.get(valueKey));
    const currentValue = row.setting_value ?? "";
    if (nextActive === row.is_active && nextValue === currentValue) {
      continue;
    }
    const { error: updateError } = await supabase
      .from("ai_settings")
      .update({
        setting_value: nextValue,
        is_active: nextActive,
        updated_at: now,
      })
      .eq("id", row.id);
    if (updateError) {
      return { ok: false, error: updateError.message };
    }
  }

  revalidateAiAdmin();
  return { ok: true };
}
