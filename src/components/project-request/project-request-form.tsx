"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { FormProgress } from "@/components/project-request/progress";
import { ProjectRequestSuccess } from "@/components/project-request/success";
import { StepFields } from "@/components/project-request/step-fields";
import { StepReview } from "@/components/project-request/step-review";
import {
  ContentStateMessage,
  OrderFormSkeleton,
} from "@/components/public/content-states";
import { getPlaceOrderLoginPath } from "@/lib/auth";
import { emptyProjectRequest } from "@/lib/order-form";
import {
  firstInvalidStep,
  getNormalizedProjectRequest,
  isReferralFieldKey,
  validateProjectRequest,
  validateStep,
} from "@/lib/project-request";
import {
  clearProjectRequestDraft,
  loadProjectRequestDraft,
  mergeProjectRequestDraft,
  saveProjectRequestDraft,
} from "@/lib/project-request-draft";
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

function subscribeNever() {
  return () => {};
}

function useIsClient() {
  return useSyncExternalStore(subscribeNever, () => true, () => false);
}

function emptyValues(
  config: OrderFormConfig,
  initialReferralCode: string,
): ProjectRequest {
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
}

export function ProjectRequestForm(props: Props) {
  const isClient = useIsClient();
  if (!isClient) {
    return <OrderFormSkeleton />;
  }
  return <ProjectRequestFormInner {...props} />;
}

function ProjectRequestFormInner({
  config,
  serviceId,
  initialReferralCode = "",
}: Props) {
  const formId = useId();
  const totalSteps = config.steps.length;
  const hasSteps = totalSteps > 0;
  const initial = useMemo(() => {
    const values = emptyValues(config, initialReferralCode);
    const draft = loadProjectRequestDraft();
    if (
      !draft ||
      (draft.serviceId && serviceId && draft.serviceId !== serviceId)
    ) {
      return {
        data: values,
        step: 1 as ProjectRequestStep,
        serviceId,
        notice: null as string | null,
      };
    }

    const step = Math.min(Math.max(draft.step, 1), Math.max(totalSteps, 1));
    return {
      data: mergeProjectRequestDraft(values, draft.data),
      step: step as ProjectRequestStep,
      serviceId: draft.serviceId ?? serviceId,
      notice:
        hasSteps && step === totalSteps
          ? "Your previous answers were restored. Review them, then submit to place the order."
          : null,
    };
  }, [config, hasSteps, initialReferralCode, serviceId, totalSteps]);

  const [step, setStep] = useState<ProjectRequestStep>(initial.step);
  const [data, setData] = useState<ProjectRequest>(initial.data);
  const [errors, setErrors] = useState<ProjectRequestErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedReferralCode, setSubmittedReferralCode] = useState("");
  const [requestNumber, setRequestNumber] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(initial.notice);
  const resolvedServiceId = initial.serviceId;
  const submittingRef = useRef(false);
  const skipPersistRef = useRef(false);
  const persistRef = useRef({
    data: initial.data,
    step: initial.step,
    serviceId: resolvedServiceId,
  });

  useEffect(() => {
    persistRef.current = {
      data,
      step,
      serviceId: resolvedServiceId,
    };
  }, [data, resolvedServiceId, step]);

  useEffect(() => {
    if (!hasSteps || submitted) {
      return;
    }

    function persistDraft() {
      if (skipPersistRef.current) {
        return;
      }

      saveProjectRequestDraft({
        data: persistRef.current.data,
        step: persistRef.current.step,
        serviceId: persistRef.current.serviceId,
      });
    }

    function handleVisibility() {
      if (document.visibilityState === "hidden") {
        persistDraft();
      }
    }

    window.addEventListener("pagehide", persistDraft);
    window.addEventListener("beforeunload", persistDraft);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      persistDraft();
      window.removeEventListener("pagehide", persistDraft);
      window.removeEventListener("beforeunload", persistDraft);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [hasSteps, submitted]);

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
    setAuthNotice(null);
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

  function redirectToAuth(normalized: ProjectRequest) {
    saveProjectRequestDraft({
      data: normalized,
      step: totalSteps,
      serviceId: resolvedServiceId,
    });
    window.location.assign(getPlaceOrderLoginPath());
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
    setAuthNotice(null);

    const normalized = getNormalizedProjectRequest(data);
    setData(normalized);

    try {
      const result = await submitProjectRequest(
        normalized,
        config,
        resolvedServiceId,
      );
      if (!result.ok) {
        if (result.unauthenticated) {
          redirectToAuth(normalized);
          return;
        }
        setFormError(result.error);
        return;
      }

      skipPersistRef.current = true;
      clearProjectRequestDraft();
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
    skipPersistRef.current = true;
    clearProjectRequestDraft();
    const values = emptyValues(config, initialReferralCode);
    setData(values);
    setErrors({});
    setStep(1);
    setSubmitted(false);
    setSubmittedReferralCode("");
    setRequestNumber(null);
    setFormError(null);
    setAuthNotice(null);
    persistRef.current = {
      data: values,
      step: 1,
      serviceId: resolvedServiceId,
    };
    skipPersistRef.current = false;
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

      {authNotice ? (
        <p className="mt-6 text-sm text-muted" role="status">
          {authNotice}
        </p>
      ) : null}

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
