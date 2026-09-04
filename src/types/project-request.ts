import type { Json } from "@/types/database";

export type OrderFormInputType =
  | "text"
  | "email"
  | "tel"
  | "textarea"
  | "date"
  | "radio"
  | "checkbox_group"
  | "select";

export type OrderFormOption = {
  id: string;
  group: string;
  slug: string;
  label: string;
  description: string | null;
  requiresText: boolean;
  sortOrder: number;
  meta: Record<string, unknown>;
};

export type OrderFormFieldConfig = {
  id: string;
  fieldKey: string;
  stepId: string;
  inputType: OrderFormInputType;
  label: string;
  hint: string | null;
  placeholder: string | null;
  optionsGroup: string | null;
  required: boolean;
  visible: boolean;
  sortOrder: number;
  conditional: Record<string, unknown>;
  constraints: Record<string, unknown>;
  defaultValue: Json | null;
  options: OrderFormOption[];
};

export type OrderFormStepConfig = {
  id: string;
  stepKey: string;
  title: string;
  description: string | null;
  sortOrder: number;
  isReview: boolean;
  fields: OrderFormFieldConfig[];
};

export type OrderFormConfig = {
  steps: OrderFormStepConfig[];
  fields: OrderFormFieldConfig[];
  optionsByGroup: Record<string, OrderFormOption[]>;
};

export type ProjectRequestValue = string | string[];
export type ProjectRequest = Record<string, ProjectRequestValue>;
export type ProjectRequestErrors = Record<string, string>;
export type ProjectRequestStep = number;
