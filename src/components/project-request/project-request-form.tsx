"use client";

import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormProgress } from "@/components/project-request/progress";
import { ProjectRequestSuccess } from "@/components/project-request/success";
import { StepFields } from "@/components/project-request/step-fields";
import { StepReview } from "@/components/project-request/step-review";
import { ContentStateMessage } from "@/components/public/content-states";
import { emptyProjectRequest } from "@/lib/order-form";
import {
  firstInvalidStep,
  getNormalizedProjectRequest,
  isReferralFieldKey,
  validateProjectRequest,
  validateStep,
} from "@/lib/project-request";
import { submitProjectRequest } from "@/lib/submit-project-request";
import type {
  OrderFormConfig,
  ProjectRequest,
  ProjectRequestErrors,
  ProjectRequestStep,
} from "@/types/project-request";

type Props = {
  config: OrderFormConfig;
  serviceId: string | null;
  initialReferralCode?: string;
};

export function ProjectRequestForm({
  config,
  serviceId,
  initialReferralCode = "",
}: Props) {
  const formId = useId();
  const totalSteps = config.steps.length;
  const hasSteps = totalSteps > 0;
  const initialValues = useMemo(() => {
    const values = emptyProjectRequest(config);
    if (initialReferralCode) {
      const referralField = config.fields.find((field) =>
        isReferralFieldKey(field.fieldKey),
      );
      if (referralField) {
        values[referralField.fieldKey] = initialReferralCode;
      }
    }
    return values;
  }, [config, initialReferralCode]);
  const [step, setStep] = useState<ProjectRequestStep>(1);
  const [data, setData] = useState<ProjectRequest>(initialValues);
  const [errors, setErrors] = useState<ProjectRequestErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedReferralCode, setSubmittedReferralCode] = useState("");
  const [requestNumber, setRequestNumber] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  function updateField(field: string, value: string | string[]) {
    const nextValue =
      isReferralFieldKey(field) && typeof value === "string"
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
    if (!hasSteps) {
      return;
    }
    setStep(Math.min(Math.max(next, 1), totalSteps));
    setFormError(null);
  }

  function handlePrevious() {
    if (!hasSteps || step <= 1) {
      return;
    }
    goToStep(step - 1);
  }

  function handleNext() {
    if (!hasSteps) {
      return;
    }

    const stepErrors = validateStep(step, data, config);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }

    setErrors({});
    goToStep(Math.min(step + 1, totalSteps));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasSteps) {
      return;
    }

    if (step < totalSteps) {
      handleNext();
      return;
    }

    if (submitting || submittingRef.current) {
      return;
    }

    const allErrors = validateProjectRequest(data, config);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      const invalid = firstInvalidStep(allErrors, config);
      if (invalid) {
        setStep(invalid);
      }
      setFormError("Please complete the required fields before submitting.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setFormError(null);

    const normalized = getNormalizedProjectRequest(data);
    setData(normalized);

    try {
      const result = await submitProjectRequest(normalized, config, serviceId);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }

      const referralField = config.fields.find((field) =>
        isReferralFieldKey(field.fieldKey),
      );
      setSubmittedReferralCode(
        referralField
          ? String(normalized[referralField.fieldKey] ?? "")
          : "",
      );
      setRequestNumber(result.requestNumber);
      setSubmitted(true);
    } catch {
      setFormError("Could not submit your project request. Please try again.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  function handleReset() {
    setData(initialValues);
    setErrors({});
    setStep(1);
    setSubmitted(false);
    setSubmittedReferralCode("");
    setRequestNumber(null);
    setFormError(null);
  }

  if (submitted) {
    return (
      <ProjectRequestSuccess
        onReset={handleReset}
        requestNumber={requestNumber}
        referralCode={submittedReferralCode}
      />
    );
  }

  if (!hasSteps) {
    return (
      <ContentStateMessage>
        The project request form is not available yet. Please check back soon.
      </ContentStateMessage>
    );
  }

  const current = config.steps[step - 1];

  return (
    <form
      id={formId}
      onSubmit={handleSubmit}
      noValidate
      className="rounded-3xl border border-card-border bg-card p-5 sm:p-8 lg:p-10"
    >
      <FormProgress step={step} config={config} />

      <div aria-live="polite">
        {current?.isReview ? (
          <StepReview data={data} config={config} onEdit={goToStep} />
        ) : current ? (
          <StepFields
            step={current}
            config={config}
            data={data}
            errors={errors}
            onChange={updateField}
          />
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

        {step < totalSteps ? (
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
