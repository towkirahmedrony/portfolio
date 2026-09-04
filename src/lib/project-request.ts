import type { Json, ProjectRequestInsert } from "@/types/database";
import {
  REFERRAL_CLIENT_DISCOUNT_PERCENT,
  REFERRAL_REFERRER_REWARD_PERCENT,
  type ProjectReferralPayload,
} from "@/types/referral";
import type {
  OrderFormConfig,
  OrderFormFieldConfig,
  OrderFormOption,
  OrderFormStepConfig,
  ProjectRequest,
  ProjectRequestErrors,
  ProjectRequestStep,
} from "@/types/project-request";
import {
  fieldNeedsDateInput,
  fieldNeedsOtherInput,
  findOption,
  getListValue,
  getStringValue,
  isFieldVisible,
  otherValueKey,
  selectedOption,
} from "@/lib/order-form";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const COLUMN_ALIASES: Record<string, string[]> = {
  full_name: ["full_name", "fullName"],
  email: ["email"],
  phone: ["phone"],
  company_name: ["company_name", "company"],
  referral_code_entered: ["referral_code_entered", "referral_code", "referralCode"],
  project_type: ["project_type", "projectType"],
  website_status: ["website_status", "websiteStatus"],
  page_count: ["page_count", "pageCount"],
  description: ["description"],
  additional_requirements: [
    "additional_requirements",
    "additionalRequirements",
  ],
  required_features: ["required_features", "features"],
  has_design: ["has_design", "hasDesign"],
  figma_url: ["figma_url", "figmaUrl"],
  reference_urls: ["reference_urls", "referenceUrls"],
  design_style: ["design_style", "designStyle"],
  design_style_other: [
    "design_style_other",
    "designStyleOther",
    otherValueKey("design_style"),
    otherValueKey("designStyle"),
  ],
  has_logo: ["has_logo", "hasLogo"],
  has_brand_colors: ["has_brand_colors", "hasBrandColors"],
  brand_colors: ["brand_colors", "brandColors"],
  budget: ["budget", "budget_range", "budgetRange"],
  deadline_type: ["deadline_type", "deadline"],
  deadline_date: ["deadline_date", "specific_date", "specificDate"],
};

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function normalizeReferralCode(value: string): string {
  return value.trim().toUpperCase();
}

export function isReferralFieldKey(fieldKey: string): boolean {
  return /referral/i.test(fieldKey);
}

export function buildProjectReferralPayload(
  data: ProjectRequest,
): ProjectReferralPayload {
  const referralCode = normalizeReferralCode(
    firstString(data, COLUMN_ALIASES.referral_code_entered),
  );

  return {
    referralCode: referralCode || null,
    referredBy: null,
    referralStatus: "unverified",
    referredProject: "first",
    clientDiscountPercent: REFERRAL_CLIENT_DISCOUNT_PERCENT,
    referrerRewardPercent: REFERRAL_REFERRER_REWARD_PERCENT,
    rewardStatus: "pending",
    rewardUsed: false,
    rewardExpiresAt: null,
    discountsStackable: false,
  };
}

export function getNormalizedProjectRequest(
  data: ProjectRequest,
): ProjectRequest {
  const next: ProjectRequest = {};

  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      next[key] = value.map((item) => item.trim()).filter((item) => item.length > 0);
      continue;
    }

    const trimmed = value.trim();
    next[key] = isReferralFieldKey(key)
      ? normalizeReferralCode(trimmed)
      : trimmed;
  }

  return next;
}

function firstString(data: ProjectRequest, keys: string[]): string {
  for (const key of keys) {
    const value = getStringValue(data, key);
    if (value) {
      return value;
    }
  }
  return "";
}

function firstList(data: ProjectRequest, keys: string[]): string[] {
  for (const key of keys) {
    const value = getListValue(data, key);
    if (value.length > 0) {
      return value;
    }
  }
  return [];
}

function fieldByKeys(
  config: OrderFormConfig,
  keys: string[],
): OrderFormFieldConfig | undefined {
  return config.fields.find((field) => keys.includes(field.fieldKey));
}

function yesNoToBoolean(value: string): boolean | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "yes" || normalized === "true" || normalized === "1") {
    return true;
  }
  if (normalized === "no" || normalized === "false" || normalized === "0") {
    return false;
  }
  return null;
}

function parseReferenceUrls(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function isFigmaUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "figma.com" || hostname.endsWith(".figma.com");
  } catch {
    return /figma\.com/i.test(value);
  }
}

function otherTextForField(
  data: ProjectRequest,
  field: OrderFormFieldConfig | undefined,
): string {
  if (!field) {
    return "";
  }

  return firstString(data, [
    otherValueKey(field.fieldKey),
    `${field.fieldKey}_other`,
    `${field.fieldKey}Other`,
    ...COLUMN_ALIASES.design_style_other,
  ]);
}

function mapPageCount(
  raw: string,
  option: OrderFormOption | undefined,
): number | null {
  const meta = option?.meta ?? {};
  const fromMeta = asNumber(
    meta.page_count ?? meta.pages ?? meta.value ?? meta.max,
  );
  if (fromMeta != null) {
    return fromMeta;
  }

  const source = option?.slug ?? raw;
  const plus = source.match(/(\d+)\s*\+/);
  if (plus) {
    return Number(plus[1]);
  }

  const range = source.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (range) {
    return Number(range[2]);
  }

  const single = source.match(/(\d+)/);
  return single ? Number(single[1]) : null;
}

function budgetFromSlug(slug: string): { min: number | null; max: number | null } {
  const plus = slug.match(/^(\d+)[-_]plus$/);
  if (plus) {
    return { min: Number(plus[1]), max: null };
  }

  const under = slug.match(/^under[-_](\d+)$/);
  if (under) {
    return { min: null, max: Number(under[1]) };
  }

  const range = slug.match(/^(\d+)[-_](\d+)$/);
  if (range) {
    return { min: Number(range[1]), max: Number(range[2]) };
  }

  return { min: null, max: null };
}

function budgetFromOption(option: OrderFormOption | undefined): {
  min: number | null;
  max: number | null;
  currency: string | null;
} {
  const meta = option?.meta ?? {};
  const currency = typeof meta.currency === "string" ? meta.currency : null;
  const fromMeta = {
    min: asNumber(meta.min ?? meta.budget_min),
    max: asNumber(meta.max ?? meta.budget_max),
  };
  const fromSlug = option ? budgetFromSlug(option.slug) : { min: null, max: null };

  return {
    min: fromMeta.min ?? fromSlug.min,
    max: fromMeta.max ?? fromSlug.max,
    currency,
  };
}

function isSpecificDeadline(option: OrderFormOption | undefined, value: string): boolean {
  if (!option) {
    return value === "specific";
  }

  if (option.slug === "specific" || option.requiresText) {
    return true;
  }

  const meta = option.meta;
  return meta.specific === true || meta.requires_date === true;
}

function buildDescription(data: ProjectRequest): string | null {
  const parts = [
    firstString(data, COLUMN_ALIASES.description),
    firstString(data, COLUMN_ALIASES.additional_requirements),
  ]
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  return parts.length > 0 ? parts.join("\n\n") : null;
}

export function generateRequestNumber(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const entropy = crypto
    .randomUUID()
    .replace(/-/g, "")
    .slice(0, 8)
    .toUpperCase();
  return `PR-${year}${month}${day}-${entropy}`;
}

export function visibleFieldsForStep(
  step: OrderFormStepConfig,
  data: ProjectRequest,
): OrderFormFieldConfig[] {
  return step.fields.filter((field) => isFieldVisible(field, data));
}

export function requiredMessage(field: OrderFormFieldConfig): string {
  if (
    field.inputType === "radio" ||
    field.inputType === "select" ||
    field.inputType === "checkbox_group"
  ) {
    if (field.fieldKey === "project_type" || field.fieldKey === "projectType") {
      return "Please select a project type.";
    }
    if (
      field.fieldKey === "website_status" ||
      field.fieldKey === "websiteStatus"
    ) {
      return "Please choose whether this is new or a redesign.";
    }
    return `Please select ${field.label.toLowerCase()}.`;
  }

  if (field.fieldKey === "full_name" || field.fieldKey === "fullName") {
    return "Please enter your full name.";
  }
  if (field.fieldKey === "email") {
    return "Please enter your email address.";
  }
  if (field.fieldKey === "description") {
    return "Please describe what you need.";
  }
  if (
    field.fieldKey === "specific_date" ||
    field.fieldKey === "specificDate" ||
    field.fieldKey === "deadline_date"
  ) {
    return "Please choose a specific date.";
  }

  return `Please enter ${field.label.toLowerCase()}.`;
}

export function validateStep(
  step: ProjectRequestStep,
  data: ProjectRequest,
  config: OrderFormConfig,
): ProjectRequestErrors {
  const current = config.steps[step - 1];
  if (!current || current.isReview) {
    return {};
  }

  const errors: ProjectRequestErrors = {};

  for (const field of visibleFieldsForStep(current, data)) {
    if (field.inputType === "checkbox_group") {
      const values = getListValue(data, field.fieldKey);
      if (field.required && values.length === 0) {
        errors[field.fieldKey] = requiredMessage(field);
      }
    } else {
      const value = getStringValue(data, field.fieldKey);
      if (field.required && isBlank(value)) {
        errors[field.fieldKey] = requiredMessage(field);
      } else if (
        field.inputType === "email" &&
        !isBlank(value) &&
        !EMAIL_PATTERN.test(value.trim())
      ) {
        errors[field.fieldKey] = "Please enter a valid email address.";
      }

      const minLength = asNumber(field.constraints.minLength ?? field.constraints.min_length);
      const maxLength = asNumber(field.constraints.maxLength ?? field.constraints.max_length);
      const pattern = field.constraints.pattern;
      if (minLength != null && value.trim().length > 0 && value.trim().length < minLength) {
        errors[field.fieldKey] = `Please enter at least ${minLength} characters.`;
      }
      if (maxLength != null && value.trim().length > maxLength) {
        errors[field.fieldKey] = `Please keep this under ${maxLength} characters.`;
      }
      if (typeof pattern === "string" && pattern && !isBlank(value)) {
        try {
          if (!new RegExp(pattern).test(value.trim())) {
            errors[field.fieldKey] = `Please enter a valid ${field.label.toLowerCase()}.`;
          }
        } catch {
        }
      }
    }

    if (fieldNeedsOtherInput(field, data)) {
      const otherKey = otherValueKey(field.fieldKey);
      const otherValue = otherTextForField(data, field);
      const followUp = config.fields.find(
        (item) =>
          item.fieldKey === otherKey ||
          item.fieldKey === `${field.fieldKey}_other` ||
          item.fieldKey === `${field.fieldKey}Other`,
      );
      if (followUp) {
        if (followUp.required && isBlank(otherValue)) {
          errors[followUp.fieldKey] = requiredMessage(followUp);
        }
      }
    }

    if (fieldNeedsDateInput(field, data)) {
      const followUp = config.fields.find((item) =>
        COLUMN_ALIASES.deadline_date.includes(item.fieldKey),
      );
      const dateKey = followUp?.fieldKey ?? otherValueKey(field.fieldKey);
      const dateValue = followUp
        ? getStringValue(data, followUp.fieldKey)
        : firstString(data, [otherValueKey(field.fieldKey), ...COLUMN_ALIASES.deadline_date]);
      if (isBlank(dateValue)) {
        errors[dateKey] = "Please choose a specific date.";
      }
    }
  }

  return errors;
}

export function validateProjectRequest(
  data: ProjectRequest,
  config: OrderFormConfig,
): ProjectRequestErrors {
  return config.steps.reduce<ProjectRequestErrors>((errors, _step, index) => {
    return { ...errors, ...validateStep(index + 1, data, config) };
  }, {});
}

export function stepHasErrors(
  errors: ProjectRequestErrors,
  step: ProjectRequestStep,
  config: OrderFormConfig,
): boolean {
  const current = config.steps[step - 1];
  if (!current) {
    return false;
  }

  const keys = new Set<string>();
  for (const field of current.fields) {
    keys.add(field.fieldKey);
    keys.add(otherValueKey(field.fieldKey));
  }

  return Object.keys(errors).some((key) => keys.has(key) && Boolean(errors[key]));
}

export function firstInvalidStep(
  errors: ProjectRequestErrors,
  config: OrderFormConfig,
): ProjectRequestStep | null {
  const index = config.steps.findIndex(
    (step, stepIndex) =>
      !step.isReview && stepHasErrors(errors, stepIndex + 1, config),
  );
  return index >= 0 ? index + 1 : null;
}

export function formatFeatureList(
  data: ProjectRequest,
  config: OrderFormConfig,
): string {
  const field = fieldByKeys(config, COLUMN_ALIASES.required_features);
  const values = firstList(
    data,
    field ? [field.fieldKey] : COLUMN_ALIASES.required_features,
  );

  if (values.length === 0) {
    return "None selected";
  }

  const options = field?.options ?? [];
  return values
    .map(
      (feature) =>
        options.find((option) => option.slug === feature)?.label ?? feature,
    )
    .join(", ");
}

export function displayFieldValue(
  field: OrderFormFieldConfig,
  data: ProjectRequest,
): string {
  if (field.inputType === "checkbox_group") {
    const values = getListValue(data, field.fieldKey);
    if (values.length === 0) {
      return "None selected";
    }
    return values
      .map(
        (value) =>
          field.options.find((option) => option.slug === value)?.label ?? value,
      )
      .join(", ");
  }

  const value = getStringValue(data, field.fieldKey);
  if (!value) {
    return "Not specified";
  }

  const option = findOption(field, value);
  if (option?.requiresText) {
    const other = otherTextForField(data, field);
    if (other) {
      return other;
    }
  }

  if (fieldNeedsDateInput(field, data)) {
    const dateValue = firstString(data, [
      otherValueKey(field.fieldKey),
      ...COLUMN_ALIASES.deadline_date,
    ]);
    if (dateValue) {
      return dateValue;
    }
  }

  if (field.inputType === "date" && value) {
    return value;
  }

  return option?.label ?? value;
}

function snapshotOption(option: OrderFormOption) {
  return {
    slug: option.slug,
    label: option.label,
    description: option.description,
    requiresText: option.requiresText,
    meta: option.meta,
  };
}

export function buildFormSnapshot(
  data: ProjectRequest,
  config: OrderFormConfig,
  serviceId: string | null,
): Json {
  return toJson({
    version: 1,
    service_id: serviceId,
    steps: config.steps.map((step) => ({
      step_key: step.stepKey,
      title: step.title,
      description: step.description,
      sort_order: step.sortOrder,
      is_review: step.isReview,
      fields: step.fields.map((field) => ({
        field_key: field.fieldKey,
        input_type: field.inputType,
        label: field.label,
        hint: field.hint,
        placeholder: field.placeholder,
        options_group: field.optionsGroup,
        required: field.required,
        visible: isFieldVisible(field, data),
        sort_order: field.sortOrder,
        conditional: field.conditional,
        constraints: field.constraints,
        options: field.options.map(snapshotOption),
        value:
          field.inputType === "checkbox_group"
            ? getListValue(data, field.fieldKey)
            : getStringValue(data, field.fieldKey),
        other_value: fieldNeedsOtherInput(field, data)
          ? otherTextForField(data, field)
          : null,
      })),
    })),
    answers: data,
  });
}

export function toProjectRequestInsert(
  data: ProjectRequest,
  requestNumber: string,
  config: OrderFormConfig,
  serviceId: string | null,
): ProjectRequestInsert {
  const referralCode = normalizeReferralCode(
    firstString(data, COLUMN_ALIASES.referral_code_entered),
  );
  const pageField = fieldByKeys(config, COLUMN_ALIASES.page_count);
  const pageRaw = firstString(
    data,
    pageField ? [pageField.fieldKey] : COLUMN_ALIASES.page_count,
  );
  const pageOption = pageField ? findOption(pageField, pageRaw) : undefined;

  const budgetField = fieldByKeys(config, COLUMN_ALIASES.budget);
  const budgetRaw = firstString(
    data,
    budgetField ? [budgetField.fieldKey] : COLUMN_ALIASES.budget,
  );
  const budgetOption = budgetField
    ? findOption(budgetField, budgetRaw)
    : undefined;
  const budget = budgetFromOption(budgetOption);

  const deadlineField = fieldByKeys(config, COLUMN_ALIASES.deadline_type);
  const deadlineRaw = firstString(
    data,
    deadlineField ? [deadlineField.fieldKey] : COLUMN_ALIASES.deadline_type,
  );
  const deadlineOption = deadlineField
    ? findOption(deadlineField, deadlineRaw)
    : undefined;

  const dateRaw = firstString(data, [
    ...COLUMN_ALIASES.deadline_date,
    deadlineField ? otherValueKey(deadlineField.fieldKey) : "",
  ].filter(Boolean));
  const designField = fieldByKeys(config, COLUMN_ALIASES.design_style);
  const designRaw = firstString(
    data,
    designField ? [designField.fieldKey] : COLUMN_ALIASES.design_style,
  );
  const designOption = designField
    ? selectedOption(designField, data)
    : undefined;
  const designOther = otherTextForField(data, designField);
  const designStyle =
    designOption?.requiresText || designRaw === "other"
      ? emptyToNull(designOther) ?? emptyToNull(designRaw)
      : emptyToNull(designRaw);

  const dedicatedFigma = emptyToNull(firstString(data, COLUMN_ALIASES.figma_url));
  const urls = parseReferenceUrls(
    firstString(data, COLUMN_ALIASES.reference_urls),
  );
  const figmaUrl = dedicatedFigma ?? urls.find(isFigmaUrl) ?? null;
  const referenceUrls = urls.filter((url) => url !== figmaUrl);

  const features = firstList(data, COLUMN_ALIASES.required_features);

  const payload: ProjectRequestInsert = {
    request_number: requestNumber,
    full_name: firstString(data, COLUMN_ALIASES.full_name).trim(),
    email: firstString(data, COLUMN_ALIASES.email).trim(),
    phone: emptyToNull(firstString(data, COLUMN_ALIASES.phone)),
    company_name: emptyToNull(firstString(data, COLUMN_ALIASES.company_name)),
    project_type: emptyToNull(firstString(data, COLUMN_ALIASES.project_type)),
    website_status: emptyToNull(
      firstString(data, COLUMN_ALIASES.website_status),
    ),
    page_count: mapPageCount(pageRaw, pageOption),
    description: buildDescription(data),
    required_features: features.length > 0 ? features : null,
    has_design: yesNoToBoolean(firstString(data, COLUMN_ALIASES.has_design)),
    figma_url: figmaUrl,
    reference_urls: referenceUrls.length > 0 ? referenceUrls : null,
    design_style: designStyle,
    has_logo: yesNoToBoolean(firstString(data, COLUMN_ALIASES.has_logo)),
    has_brand_colors: yesNoToBoolean(
      firstString(data, COLUMN_ALIASES.has_brand_colors),
    ),
    brand_colors: emptyToNull(firstString(data, COLUMN_ALIASES.brand_colors)),
    budget_min: budget.min,
    budget_max: budget.max,
    deadline_type: emptyToNull(deadlineRaw),
    deadline_date: isSpecificDeadline(deadlineOption, deadlineRaw)
      ? emptyToNull(dateRaw)
      : null,
    referral_code_entered: referralCode || null,
    source: "start-project",
    service_id: serviceId,
    form_snapshot: buildFormSnapshot(data, config, serviceId),
  };

  if (budget.currency) {
    payload.budget_currency = budget.currency;
  }

  return payload;
}
