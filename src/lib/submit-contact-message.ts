"use server";

import { revalidatePath } from "next/cache";
import { isValidEmail } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { notifyNewContactMessageSafe } from "@/lib/telegram";

const NAME_MAX = 120;
const EMAIL_MAX = 254;
const PHONE_MAX = 40;
const SUBJECT_MAX = 200;
const MESSAGE_MAX = 5_000;

export type ContactFieldErrors = {
  name?: string;
  email?: string;
  phone?: string;
  subject?: string;
  message?: string;
};

export type SubmitContactMessageResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: ContactFieldErrors };

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function emptyToNull(value: string): string | null {
  return value.length > 0 ? value : null;
}

function validateContactForm(input: {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}): ContactFieldErrors {
  const fieldErrors: ContactFieldErrors = {};

  if (input.name.length === 0) {
    fieldErrors.name = "Please enter your name.";
  } else if (input.name.length > NAME_MAX) {
    fieldErrors.name = `Name must be ${NAME_MAX} characters or fewer.`;
  }

  if (input.email.length === 0) {
    fieldErrors.email = "Please enter your email address.";
  } else if (input.email.length > EMAIL_MAX || !isValidEmail(input.email)) {
    fieldErrors.email = "Please enter a valid email address.";
  }

  if (input.phone.length > 0) {
    if (input.phone.length > PHONE_MAX) {
      fieldErrors.phone = `Phone must be ${PHONE_MAX} characters or fewer.`;
    } else if (input.phone.replace(/\D/g, "").length < 7) {
      fieldErrors.phone = "Please enter a valid phone or WhatsApp number.";
    }
  }

  if (input.subject.length > SUBJECT_MAX) {
    fieldErrors.subject = `Subject must be ${SUBJECT_MAX} characters or fewer.`;
  }

  if (input.message.length === 0) {
    fieldErrors.message = "Please enter a message.";
  } else if (input.message.length > MESSAGE_MAX) {
    fieldErrors.message = `Message must be ${MESSAGE_MAX} characters or fewer.`;
  }

  return fieldErrors;
}

export async function submitContactMessage(
  _prev: SubmitContactMessageResult | null,
  formData: FormData,
): Promise<SubmitContactMessageResult> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: "The contact form is not configured yet. Please try again later.",
    };
  }

  const name = asString(formData.get("name"));
  const email = asString(formData.get("email"));
  const phone = asString(formData.get("phone"));
  const subject = asString(formData.get("subject"));
  const message = asString(formData.get("message"));

  const fieldErrors = validateContactForm({ name, email, phone, subject, message });
  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      error: "Please check the highlighted fields and try again.",
      fieldErrors,
    };
  }

  const payload = {
    name,
    email,
    phone: emptyToNull(phone),
    subject: emptyToNull(subject),
    message,
  };

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("contact_messages").insert(payload);

    if (error) {
      console.error("[contact] insert failed", { message: error.message, code: error.code });
      return {
        ok: false,
        error: "Could not send your message. Please try again.",
      };
    }
  } catch (error) {
    console.error("[contact] insert failed", {
      error: error instanceof Error ? error.message : "unknown error",
    });
    return {
      ok: false,
      error: "Could not send your message. Please try again.",
    };
  }

  await notifyNewContactMessageSafe({
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
    subject: payload.subject,
    message: payload.message,
  });

  revalidatePath("/admin/contact-messages");
  return { ok: true };
}
