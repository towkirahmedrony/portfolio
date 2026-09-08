import type { QueryResult } from "@/lib/admin-project-constants";
import type {
  OrderFormFieldRow,
  OrderFormOptionRow,
  OrderFormStepRow,
} from "@/types/database";
import type { OrderFormInputType } from "@/types/project-request";

export type { QueryResult };

export const ORDER_FORM_INPUT_TYPES: OrderFormInputType[] = [
  "text",
  "email",
  "tel",
  "textarea",
  "date",
  "radio",
  "checkbox_group",
  "select",
  "file",
];

export const SELECTABLE_INPUT_TYPES: OrderFormInputType[] = [
  "radio",
  "checkbox_group",
  "select",
];

export const PLACEHOLDER_INPUT_TYPES: OrderFormInputType[] = [
  "text",
  "email",
  "tel",
  "textarea",
  "date",
  "select",
];

const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

export type AdminOrderFormOption = OrderFormOptionRow;

export type AdminOrderFormField = OrderFormFieldRow & {
  options: AdminOrderFormOption[];
};

export type AdminOrderFormStep = OrderFormStepRow & {
  fields: AdminOrderFormField[];
};

export type AdminOrderFormTree = {
  steps: AdminOrderFormStep[];
  ungroupedOptions: AdminOrderFormOption[];
};

export function isOrderFormInputType(value: string): value is OrderFormInputType {
  return ORDER_FORM_INPUT_TYPES.includes(value as OrderFormInputType);
}

export function isSelectableInputType(value: string): boolean {
  return SELECTABLE_INPUT_TYPES.includes(value as OrderFormInputType);
}

export function usesPlaceholder(value: string): boolean {
  return PLACEHOLDER_INPUT_TYPES.includes(value as OrderFormInputType);
}

export function keyify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function isValidFormKey(value: string): boolean {
  return value.length > 0 && value.length <= 80 && KEY_PATTERN.test(value);
}

export function inputTypeLabel(type: string): string {
  switch (type) {
    case "text":
      return "Text";
    case "email":
      return "Email";
    case "tel":
      return "Phone";
    case "textarea":
      return "Long text";
    case "date":
      return "Date";
    case "radio":
      return "Radio";
    case "checkbox_group":
      return "Checkboxes";
    case "select":
      return "Select";
    case "file":
      return "File";
    default:
      return type;
  }
}

export function uniqueErrorMessage(errorMessage: string, fallback: string): string {
  const message = errorMessage.toLowerCase();
  if (
    message.includes("duplicate") ||
    message.includes("unique") ||
    message.includes("already exists")
  ) {
    return fallback;
  }
  return errorMessage;
}
