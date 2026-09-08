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
  "file",
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
  if (field.inputType === "checkbox_group" || field.inputType === "file") {
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

export function isFileField(field: Pick<OrderFormFieldConfig, "inputType">): boolean {
  return field.inputType === "file";
}

function asUnknownRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function fieldDependsOn(field: OrderFormFieldConfig): string | null {
  const conditional = field.conditional;
  const showWhen = asUnknownRecord(conditional.show_when);
  const hideWhen = asUnknownRecord(conditional.hide_when);
  return (
    conditionFieldKey(showWhen) ??
    conditionFieldKey(hideWhen) ??
    conditionFieldKey(conditional) ??
    Object.keys(conditional).find(
      (key) =>
        ![
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
        ].includes(key),
    ) ??
    null
  );
}

export function fileFieldMaxFiles(field: OrderFormFieldConfig): number {
  const raw = field.constraints.max_files ?? field.constraints.maxFiles;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw);
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }
  return 1;
}

export function fileFieldCategory(field: OrderFormFieldConfig): string {
  const raw = field.constraints.category;
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : "attachment";
}

export function fileFieldKeys(config: OrderFormConfig): string[] {
  return config.fields.filter((field) => field.inputType === "file").map((field) => field.fieldKey);
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

  return ensureConditionalUploadFields(
    ensureRequiredPhoneField({
      steps: stepConfigs,
      fields: fieldConfigs,
      optionsByGroup,
    }),
  );
}

function ensureRequiredPhoneField(config: OrderFormConfig): OrderFormConfig {
  const existing = config.fields.find((field) => field.fieldKey === "phone");
  if (existing) {
    const fields = config.fields.map((field) =>
      field.fieldKey === "phone"
        ? { ...field, required: true, visible: true, inputType: "tel" as const }
        : field,
    );
    return {
      ...config,
      fields,
      steps: config.steps.map((step) => ({
        ...step,
        fields: step.fields.map((field) =>
          field.fieldKey === "phone"
            ? { ...field, required: true, visible: true, inputType: "tel" as const }
            : field,
        ),
      })),
    };
  }

  const host = config.steps.find((step) => !step.isReview && step.fields.length > 0);
  if (!host) {
    return config;
  }

  const phoneField: OrderFormFieldConfig = {
    id: "runtime-phone",
    fieldKey: "phone",
    stepId: host.id,
    inputType: "tel",
    label: "Phone Number",
    hint: "Required so we can reach you about this request.",
    placeholder: "Your phone number",
    optionsGroup: null,
    required: true,
    visible: true,
    sortOrder: (host.fields.find((field) => field.fieldKey === "email")?.sortOrder ?? 0) + 1,
    conditional: {},
    constraints: { span: "full" },
    defaultValue: null,
    options: [],
  };

  return appendFields(config, [phoneField]);
}

function appendFields(
  config: OrderFormConfig,
  extras: OrderFormFieldConfig[],
): OrderFormConfig {
  if (extras.length === 0) {
    return config;
  }
  const byStep = new Map<string, OrderFormFieldConfig[]>();
  for (const field of extras) {
    const list = byStep.get(field.stepId) ?? [];
    list.push(field);
    byStep.set(field.stepId, list);
  }
  return {
    ...config,
    fields: [...config.fields, ...extras],
    steps: config.steps.map((step) => {
      const extra = byStep.get(step.id);
      return extra ? { ...step, fields: [...step.fields, ...extra] } : step;
    }),
  };
}

function ensureConditionalUploadFields(config: OrderFormConfig): OrderFormConfig {
  const extras: OrderFormFieldConfig[] = [];
  const hasField = (key: string) =>
    config.fields.some((field) => field.fieldKey === key) ||
    extras.some((field) => field.fieldKey === key);

  const logoParent = config.fields.find(
    (field) => field.fieldKey === "has_logo" || field.fieldKey === "hasLogo",
  );
  if (logoParent && !hasField("logo_file")) {
    extras.push({
      id: "runtime-logo-file",
      fieldKey: "logo_file",
      stepId: logoParent.stepId,
      inputType: "file",
      label: "Upload Logo",
      hint: "Optional. JPG, PNG, WEBP, SVG, PDF, or ZIP.",
      placeholder: null,
      optionsGroup: null,
      required: false,
      visible: true,
      sortOrder: logoParent.sortOrder + 1,
      conditional: {
        show_when: { field: logoParent.fieldKey, in: ["yes", "true", "1"] },
      },
      constraints: { category: "logo", max_files: 1, span: "full" },
      defaultValue: null,
      options: [],
    });
  }

  const websiteParent = config.fields.find(
    (field) =>
      field.fieldKey === "website_status" || field.fieldKey === "websiteStatus",
  );
  if (websiteParent) {
    const redesignSlugs = websiteParent.options
      .filter(
        (option) =>
          /redesign/i.test(option.slug) || /redesign/i.test(option.label),
      )
      .map((option) => option.slug);
    const slugs = redesignSlugs.length > 0 ? redesignSlugs : ["redesign"];
    const showWhen = {
      show_when: { field: websiteParent.fieldKey, in: slugs },
    };

    if (!hasField("reference_urls") && !hasField("referenceUrls")) {
      extras.push({
        id: "runtime-reference-urls",
        fieldKey: "reference_urls",
        stepId: websiteParent.stepId,
        inputType: "text",
        label: "Website/Reference URL",
        hint: "Optional. Paste a current site or inspiration link.",
        placeholder: "https://",
        optionsGroup: null,
        required: false,
        visible: true,
        sortOrder: websiteParent.sortOrder + 1,
        conditional: showWhen,
        constraints: { span: "full" },
        defaultValue: null,
        options: [],
      });
    } else {
      const existing = config.fields.find(
        (field) =>
          field.fieldKey === "reference_urls" || field.fieldKey === "referenceUrls",
      );
      if (existing && Object.keys(existing.conditional).length === 0) {
        existing.conditional = showWhen;
      }
    }

    if (!hasField("website_reference_file")) {
      const reference = [...config.fields, ...extras].find(
        (field) =>
          field.fieldKey === "reference_urls" || field.fieldKey === "referenceUrls",
      );
      extras.push({
        id: "runtime-website-reference-file",
        fieldKey: "website_reference_file",
        stepId: websiteParent.stepId,
        inputType: "file",
        label: "Reference photo or file",
        hint: "Optional. Independent from the URL — you can add a file, a link, both, or neither.",
        placeholder: null,
        optionsGroup: null,
        required: false,
        visible: true,
        sortOrder: (reference?.sortOrder ?? websiteParent.sortOrder) + 1,
        conditional: showWhen,
        constraints: { category: "attachment", max_files: 3, span: "full" },
        defaultValue: null,
        options: [],
      });
    }
  }

  return appendFields(config, extras);
}
