import { featureOptions } from "@/data/project-request";
import {
  REFERRAL_CLIENT_DISCOUNT_PERCENT,
  REFERRAL_REFERRER_REWARD_PERCENT,
  type ProjectReferralPayload,
} from "@/types/referral";
import type {
  ProjectRequest,
  ProjectRequestErrors,
  ProjectRequestStep,
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
    referralCode: normalizeReferralCode(data.referralCode),
  };
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
