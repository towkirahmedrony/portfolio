import type {
  Json,
  OrderFormFieldRow,
  OrderFormOptionRow,
  OrderFormStepRow,
} from "@/types/database";
import type {
  OrderFormConfig,
  OrderFormFieldConfig,
  OrderFormInputType,
  OrderFormOption,
  OrderFormStepConfig,
  ProjectRequest,
  ProjectRequestValue,
} from "@/types/project-request";

const INPUT_TYPES = new Set<OrderFormInputType>([
  "text",
  "email",
  "tel",
  "textarea",
  "date",
  "radio",
  "checkbox_group",
  "select",
]);

export const BOOLEAN_OPTIONS: OrderFormOption[] = [
  {
    id: "yes",
    group: "yes_no",
    slug: "yes",
    label: "Yes",
    description: null,
    requiresText: false,
    sortOrder: 0,
    meta: {},
  },
  {
    id: "no",
    group: "yes_no",
    slug: "no",
    label: "No",
    description: null,
    requiresText: false,
    sortOrder: 1,
    meta: {},
  },
];

function asRecord(value: Json | null | undefined): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function toInputType(value: string): OrderFormInputType | null {
  return INPUT_TYPES.has(value as OrderFormInputType)
    ? (value as OrderFormInputType)
    : null;
}

function toOption(row: OrderFormOptionRow): OrderFormOption {
  return {
    id: row.id,
    group: row.group,
    slug: row.slug,
    label: row.label,
    description: row.description,
    requiresText: row.requires_text,
    sortOrder: row.sort_order,
    meta: asRecord(row.meta),
  };
}

function isReviewStep(
  stepKey: string,
  fieldCount: number,
  isLast: boolean,
  hasFieldSteps: boolean,
): boolean {
  if (stepKey === "review") {
    return true;
  }
  return hasFieldSteps && fieldCount === 0 && isLast;
}

function optionsForField(
  field: OrderFormFieldRow,
  inputType: OrderFormInputType,
  optionsByGroup: Record<string, OrderFormOption[]>,
): OrderFormOption[] {
  if (field.options_group) {
    return optionsByGroup[field.options_group] ?? [];
  }

  if (inputType === "radio") {
    return BOOLEAN_OPTIONS;
  }

  return [];
}

export function emptyProjectRequest(config: OrderFormConfig): ProjectRequest {
  const values: ProjectRequest = {};

  for (const field of config.fields) {
    values[field.fieldKey] = defaultFieldValue(field);
    if (
      field.options.some(
        (option) =>
          option.requiresText ||
          option.slug === "specific" ||
          option.meta.requires_date === true ||
          option.meta.specific === true,
      )
    ) {
      const otherKey = otherValueKey(field.fieldKey);
      if (!(otherKey in values)) {
        values[otherKey] = "";
      }
    }
  }

  return values;
}

export function defaultFieldValue(field: OrderFormFieldConfig): ProjectRequestValue {
  if (field.inputType === "checkbox_group") {
    if (Array.isArray(field.defaultValue)) {
      return field.defaultValue.map((item) => String(item));
    }
    return [];
  }

  if (field.defaultValue == null) {
    return "";
  }

  if (typeof field.defaultValue === "boolean") {
    return field.defaultValue ? "yes" : "no";
  }

  if (typeof field.defaultValue === "object") {
    const record = asRecord(field.defaultValue);
    if (record.value != null) {
      return String(record.value);
    }
    return "";
  }

  return String(field.defaultValue);
}

export function otherValueKey(fieldKey: string): string {
  return `${fieldKey}__other`;
}

export function getStringValue(
  values: ProjectRequest,
  key: string,
): string {
  const value = values[key];
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return "";
}

export function getListValue(values: ProjectRequest, key: string): string[] {
  const value = values[key];
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string" && value.length > 0) {
    return [value];
  }
  return [];
}

function conditionFieldKey(source: Record<string, unknown>): string | null {
  const key = source.field ?? source.field_key ?? source.key;
  return typeof key === "string" && key.length > 0 ? key : null;
}

function expectedValues(source: Record<string, unknown>): unknown[] | null {
  if (Object.prototype.hasOwnProperty.call(source, "equals")) {
    return [source.equals];
  }
  if (Object.prototype.hasOwnProperty.call(source, "value")) {
    return [source.value];
  }
  if (Array.isArray(source.in)) {
    return source.in;
  }
  if (Array.isArray(source.values)) {
    return source.values;
  }
  if (Object.prototype.hasOwnProperty.call(source, "not")) {
    return [source.not];
  }
  return null;
}

function valuesMatch(actual: ProjectRequestValue | undefined, expected: unknown[]): boolean {
  const actualList = Array.isArray(actual)
    ? actual
    : actual == null || actual === ""
      ? []
      : [actual];

  return expected.some((item) => actualList.includes(String(item)));
}

export function isFieldVisible(
  field: OrderFormFieldConfig,
  values: ProjectRequest,
): boolean {
  if (!field.visible) {
    return false;
  }

  const conditional = field.conditional;
  const keys = Object.keys(conditional);
  if (keys.length === 0) {
    return true;
  }

  const showWhen = asRecord(
    (conditional.show_when as Json | undefined) ?? null,
  );
  const hideWhen = asRecord(
    (conditional.hide_when as Json | undefined) ?? null,
  );

  if (Object.keys(showWhen).length > 0) {
    const fieldKey = conditionFieldKey(showWhen) ?? Object.keys(showWhen)[0];
    const expected =
      expectedValues(showWhen) ??
      (fieldKey && fieldKey in showWhen ? [showWhen[fieldKey]] : null);
    if (!fieldKey || !expected || !valuesMatch(values[fieldKey], expected)) {
      return false;
    }
  }

  if (Object.keys(hideWhen).length > 0) {
    const fieldKey = conditionFieldKey(hideWhen) ?? Object.keys(hideWhen)[0];
    const expected =
      expectedValues(hideWhen) ??
      (fieldKey && fieldKey in hideWhen ? [hideWhen[fieldKey]] : null);
    if (fieldKey && expected && valuesMatch(values[fieldKey], expected)) {
      return false;
    }
  }

  const directKey = conditionFieldKey(conditional);
  if (directKey) {
    const expected = expectedValues(conditional);
    if (expected) {
      const matches = valuesMatch(values[directKey], expected);
      return Object.prototype.hasOwnProperty.call(conditional, "not")
        ? !matches
        : matches;
    }
  }

  const reserved = new Set([
    "field",
    "field_key",
    "key",
    "equals",
    "value",
    "in",
    "values",
    "not",
    "show_when",
    "hide_when",
    "op",
  ]);
  const shorthand = keys.filter((key) => !reserved.has(key));
  if (shorthand.length > 0) {
    return shorthand.every((key) => valuesMatch(values[key], [conditional[key]]));
  }

  return true;
}

export function findOption(
  field: OrderFormFieldConfig,
  slug: string,
): OrderFormOption | undefined {
  return field.options.find((option) => option.slug === slug);
}

export function selectedOption(
  field: OrderFormFieldConfig,
  values: ProjectRequest,
): OrderFormOption | undefined {
  return findOption(field, getStringValue(values, field.fieldKey));
}

export function fieldNeedsOtherInput(
  field: OrderFormFieldConfig,
  values: ProjectRequest,
): boolean {
  return Boolean(selectedOption(field, values)?.requiresText);
}

export function fieldNeedsDateInput(
  field: OrderFormFieldConfig,
  values: ProjectRequest,
): boolean {
  const selected = selectedOption(field, values);
  if (!selected) {
    return false;
  }

  return (
    selected.slug === "specific" ||
    selected.meta.specific === true ||
    selected.meta.requires_date === true
  );
}

export function getOptionLabel(
  options: Array<{ slug?: string; value?: string; label: string }>,
  value: string,
): string {
  if (!value) {
    return "Not specified";
  }

  return (
    options.find((option) => option.slug === value || option.value === value)
      ?.label ?? value
  );
}

export function radioColumns(field: OrderFormFieldConfig): 1 | 2 | 3 {
  const fromConstraints = field.constraints.columns;
  if (fromConstraints === 1 || fromConstraints === 2 || fromConstraints === 3) {
    return fromConstraints;
  }

  if (field.options.length >= 6) {
    return 3;
  }
  if (field.options.length <= 2) {
    return 2;
  }
  return 2;
}

export function parseStartProjectSearchParams(searchParams: {
  ref?: string | string[];
  service?: string | string[];
  service_id?: string | string[];
}): {
  referralCode: string;
  serviceParam: string | null;
} {
  const first = (value: string | string[] | undefined): string => {
    if (Array.isArray(value)) {
      return value[0] ?? "";
    }
    return value ?? "";
  };

  const referralCode = first(searchParams.ref).trim().toUpperCase();
  const serviceParam =
    first(searchParams.service).trim() || first(searchParams.service_id).trim();

  return {
    referralCode,
    serviceParam: serviceParam.length > 0 ? serviceParam : null,
  };
}

export function buildOrderFormConfig(
  steps: OrderFormStepRow[],
  fields: OrderFormFieldRow[],
  options: OrderFormOptionRow[],
): OrderFormConfig {
  const optionsByGroup: Record<string, OrderFormOption[]> = {};
  for (const option of options.map(toOption)) {
    const list = optionsByGroup[option.group] ?? [];
    list.push(option);
    optionsByGroup[option.group] = list;
  }

  const fieldConfigs: OrderFormFieldConfig[] = fields.flatMap((row) => {
    const inputType = toInputType(row.input_type);
    if (!inputType) {
      return [];
    }

    return [
      {
        id: row.id,
        fieldKey: row.field_key,
        stepId: row.step_id,
        inputType,
        label: row.label,
        hint: row.hint,
        placeholder: row.placeholder,
        optionsGroup: row.options_group,
        required: row.required,
        visible: row.visible,
        sortOrder: row.sort_order,
        conditional: asRecord(row.conditional),
        constraints: asRecord(row.constraints),
        defaultValue: row.default_value,
        options: optionsForField(row, inputType, optionsByGroup),
      },
    ];
  });

  const fieldsByStep = new Map<string, OrderFormFieldConfig[]>();
  for (const field of fieldConfigs) {
    const list = fieldsByStep.get(field.stepId) ?? [];
    list.push(field);
    fieldsByStep.set(field.stepId, list);
  }

  const hasFieldSteps = steps.some(
    (step) => (fieldsByStep.get(step.id) ?? []).length > 0,
  );

  const stepConfigs: OrderFormStepConfig[] = steps.map((step, index) => {
    const stepFields = fieldsByStep.get(step.id) ?? [];
    const isLast = index === steps.length - 1;
    return {
      id: step.id,
      stepKey: step.step_key,
      title: step.title,
      description: step.description,
      sortOrder: step.sort_order,
      isReview: isReviewStep(
        step.step_key,
        stepFields.length,
        isLast,
        hasFieldSteps,
      ),
      fields: stepFields,
    };
  });

  return {
    steps: stepConfigs,
    fields: fieldConfigs,
    optionsByGroup,
  };
}
