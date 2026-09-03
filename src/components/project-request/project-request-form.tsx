"use client";

import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormProgress } from "@/components/project-request/progress";
import { ProjectRequestSuccess } from "@/components/project-request/success";
import { StepBudget } from "@/components/project-request/step-budget";
import { StepClient } from "@/components/project-request/step-client";
import { StepDesign } from "@/components/project-request/step-design";
import { StepRequirements } from "@/components/project-request/step-requirements";
import { StepReview } from "@/components/project-request/step-review";
import { StepType } from "@/components/project-request/step-type";
import { initialProjectRequest, TOTAL_STEPS } from "@/data/project-request";
import {
  buildProjectReferralPayload,
  firstInvalidStep,
  getNormalizedProjectRequest,
  validateProjectRequest,
  validateStep,
} from "@/lib/project-request";
import type {
  ProjectRequest,
  ProjectRequestErrors,
  ProjectRequestStep,
} from "@/types/project-request";
import type { ProjectReferralPayload } from "@/types/referral";

export function ProjectRequestForm() {
  const formId = useId();
  const [step, setStep] = useState<ProjectRequestStep>(1);
  const [data, setData] = useState<ProjectRequest>(initialProjectRequest);
  const [errors, setErrors] = useState<ProjectRequestErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedData, setSubmittedData] = useState<ProjectRequest | null>(
    null,
  );
  const [submittedReferral, setSubmittedReferral] =
    useState<ProjectReferralPayload | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function updateField<K extends keyof ProjectRequest>(
    field: K,
    value: ProjectRequest[K],
  ) {
    const nextValue =
      field === "referralCode" && typeof value === "string"
        ? value.toUpperCase()
        : value;

    setData((current) => ({ ...current, [field]: nextValue }));
    setErrors((current) => {
      if (!current[field]) {
        return current;
      }
      const next = { ...current };
      delete next[field];
      return next;
    });
    setFormError(null);
  }

  function goToStep(next: ProjectRequestStep) {
    setStep(next);
    setFormError(null);
  }

  function handlePrevious() {
    if (step === 1) {
      return;
    }
    goToStep((step - 1) as ProjectRequestStep);
  }

  function handleNext() {
    const stepErrors = validateStep(step, data);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }

    setErrors({});
    goToStep(Math.min(step + 1, TOTAL_STEPS) as ProjectRequestStep);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (step < TOTAL_STEPS) {
      handleNext();
      return;
    }

    const allErrors = validateProjectRequest(data);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      const invalid = firstInvalidStep(allErrors);
      if (invalid) {
        setStep(invalid);
      }
      setFormError("Please complete the required fields before submitting.");
      return;
    }

    setSubmitting(true);
    setFormError(null);

    const normalized = getNormalizedProjectRequest(data);
    const referral = buildProjectReferralPayload(normalized);

    await new Promise((resolve) => {
      window.setTimeout(resolve, 700);
    });

    setData(normalized);
    setSubmittedData(normalized);
    setSubmittedReferral(referral);
    setSubmitting(false);
    setSubmitted(true);
  }

  function handleReset() {
    setData(initialProjectRequest);
    setErrors({});
    setStep(1);
    setSubmitted(false);
    setSubmittedData(null);
    setSubmittedReferral(null);
    setFormError(null);
  }

  if (submitted) {
    return (
      <ProjectRequestSuccess
        onReset={handleReset}
        referralCode={submittedReferral?.referralCode ?? submittedData?.referralCode ?? ""}
      />
    );
  }

  return (
    <form
      id={formId}
      onSubmit={handleSubmit}
      noValidate
      className="rounded-3xl border border-card-border bg-card p-5 sm:p-8 lg:p-10"
    >
      <FormProgress step={step} />

      <div aria-live="polite">
        {step === 1 ? (
          <StepClient data={data} errors={errors} onChange={updateField} />
        ) : null}
        {step === 2 ? (
          <StepType data={data} errors={errors} onChange={updateField} />
        ) : null}
        {step === 3 ? (
          <StepRequirements
            data={data}
            errors={errors}
            onChange={updateField}
          />
        ) : null}
        {step === 4 ? (
          <StepDesign data={data} onChange={updateField} />
        ) : null}
        {step === 5 ? (
          <StepBudget data={data} errors={errors} onChange={updateField} />
        ) : null}
        {step === 6 ? (
          <StepReview data={data} onEdit={goToStep} />
        ) : null}
      </div>

      {formError ? (
        <p className="mt-6 text-sm text-accent" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button
          variant="secondary"
          onClick={handlePrevious}
          disabled={step === 1 || submitting}
        >
          Previous
        </Button>

        {step < TOTAL_STEPS ? (
          <Button type="submit" disabled={submitting}>
            Next
          </Button>
        ) : (
          <Button type="submit" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit Project Request"}
          </Button>
        )}
      </div>
    </form>
  );
}
