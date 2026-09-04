import { featureOptions } from "@/data/project-request";
import {
  REFERRAL_CLIENT_DISCOUNT_PERCENT,
  REFERRAL_REFERRER_REWARD_PERCENT,
  type ProjectReferralPayload,
} from "@/types/referral";
import type { ProjectRequestInsert } from "@/types/database";
import type {
  BudgetRange,
  ProjectRequest,
  ProjectRequestErrors,
  ProjectRequestStep,
  YesNo,
} from "@/types/project-request";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

export function normalizeReferralCode(value: string): string {
  return value.trim().toUpperCase();
}

export function buildProjectReferralPayload(
  data: ProjectRequest,
): ProjectReferralPayload {
  const referralCode = normalizeReferralCode(data.referralCode);

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
  return {
    ...data,
    fullName: data.fullName.trim(),
    email: data.email.trim(),
    phone: data.phone.trim(),
    company: data.company.trim(),
    referralCode: normalizeReferralCode(data.referralCode),
    description: data.description.trim(),
    additionalRequirements: data.additionalRequirements.trim(),
    referenceUrls: data.referenceUrls.trim(),
    designStyleOther: data.designStyleOther.trim(),
    specificDate: data.specificDate.trim(),
  };
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function yesNoToBoolean(value: YesNo | ""): boolean | null {
  if (value === "yes") {
    return true;
  }
  if (value === "no") {
    return false;
  }
  return null;
}

function mapPageCount(value: string): number | null {
  switch (value.replace(/-/g, "–")) {
    case "1–3 pages":
      return 3;
    case "4–6 pages":
      return 6;
    case "7–10 pages":
      return 10;
    case "10+ pages":
      return 10;
    default:
      return null;
  }
}

const BUDGET_BOUNDS: Record<
  BudgetRange,
  { min: number | null; max: number | null }
> = {
  "under-100": { min: null, max: 100 },
  "100-300": { min: 100, max: 300 },
  "300-500": { min: 300, max: 500 },
  "500-1000": { min: 500, max: 1000 },
  "1000-plus": { min: 1000, max: null },
};

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

function buildDescription(data: ProjectRequest): string | null {
  const parts = [data.description, data.additionalRequirements]
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

export function toProjectRequestInsert(
  data: ProjectRequest,
  requestNumber: string,
): ProjectRequestInsert {
  const referralCode = normalizeReferralCode(data.referralCode);
  const urls = parseReferenceUrls(data.referenceUrls);
  const figmaUrl = urls.find(isFigmaUrl) ?? null;
  const referenceUrls = urls.filter((url) => url !== figmaUrl);
  const budget = data.budget ? BUDGET_BOUNDS[data.budget] : null;
  const designStyle =
    data.designStyle === "other"
      ? emptyToNull(data.designStyleOther) ?? "other"
      : emptyToNull(data.designStyle);

  const payload: ProjectRequestInsert = {
    request_number: requestNumber,
    full_name: data.fullName.trim(),
    email: data.email.trim(),
    phone: emptyToNull(data.phone),
    company_name: emptyToNull(data.company),
    project_type: emptyToNull(data.projectType),
    website_status: emptyToNull(data.websiteStatus),
    page_count: mapPageCount(data.pageCount),
    description: buildDescription(data),
    required_features: data.features.length > 0 ? data.features : null,
    has_design: yesNoToBoolean(data.hasDesign),
    figma_url: figmaUrl,
    reference_urls: referenceUrls.length > 0 ? referenceUrls : null,
    design_style: designStyle,
    has_logo: yesNoToBoolean(data.hasLogo),
    has_brand_colors: yesNoToBoolean(data.hasBrandColors),
    brand_colors: null,
    budget_min: budget?.min ?? null,
    budget_max: budget?.max ?? null,
    deadline_type: emptyToNull(data.deadline),
    deadline_date:
      data.deadline === "specific" ? emptyToNull(data.specificDate) : null,
    referral_code_entered: referralCode || null,
    source: "start-project",
  };

  if (data.budget) {
    payload.budget_currency = "USD";
  }

  return payload;
}

export function validateStep(
  step: ProjectRequestStep,
  data: ProjectRequest,
): ProjectRequestErrors {
  const errors: ProjectRequestErrors = {};

  if (step === 1) {
    if (isBlank(data.fullName)) {
      errors.fullName = "Please enter your full name.";
    }

    if (isBlank(data.email)) {
      errors.email = "Please enter your email address.";
    } else if (!EMAIL_PATTERN.test(data.email.trim())) {
      errors.email = "Please enter a valid email address.";
    }
  }

  if (step === 2) {
    if (!data.projectType) {
      errors.projectType = "Please select a project type.";
    }

    if (!data.websiteStatus) {
      errors.websiteStatus = "Please choose whether this is new or a redesign.";
    }
  }

  if (step === 3) {
    if (isBlank(data.description)) {
      errors.description = "Please describe what you need.";
    }
  }

  if (step === 5 && data.deadline === "specific" && isBlank(data.specificDate)) {
    errors.specificDate = "Please choose a specific date.";
  }

  return errors;
}

export function validateProjectRequest(data: ProjectRequest): ProjectRequestErrors {
  return {
    ...validateStep(1, data),
    ...validateStep(2, data),
    ...validateStep(3, data),
    ...validateStep(5, data),
  };
}

export function stepHasErrors(
  errors: ProjectRequestErrors,
  step: ProjectRequestStep,
): boolean {
  const keysByStep: Record<ProjectRequestStep, Array<keyof ProjectRequest>> = {
    1: ["fullName", "email", "phone", "company", "referralCode"],
    2: ["projectType", "websiteStatus"],
    3: ["pageCount", "description", "features", "additionalRequirements"],
    4: [
      "hasDesign",
      "referenceUrls",
      "designStyle",
      "designStyleOther",
      "hasLogo",
      "hasBrandColors",
    ],
    5: ["budget", "deadline", "specificDate"],
    6: [],
  };

  return keysByStep[step].some((key) => Boolean(errors[key]));
}

export function firstInvalidStep(
  errors: ProjectRequestErrors,
): ProjectRequestStep | null {
  const steps: ProjectRequestStep[] = [1, 2, 3, 4, 5];
  return steps.find((step) => stepHasErrors(errors, step)) ?? null;
}

export function formatFeatureList(data: ProjectRequest): string {
  if (data.features.length === 0) {
    return "None selected";
  }

  return data.features
    .map(
      (feature) =>
        featureOptions.find((option) => option.value === feature)?.label ??
        feature,
    )
    .join(", ");
}
