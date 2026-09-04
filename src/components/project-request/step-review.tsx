import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { getStringValue, isFieldVisible } from "@/lib/order-form";
import {
  displayFieldValue,
  isReferralFieldKey,
  normalizeReferralCode,
} from "@/lib/project-request";
import type {
  OrderFormConfig,
  OrderFormStepConfig,
  ProjectRequest,
  ProjectRequestStep,
} from "@/types/project-request";

type Props = {
  data: ProjectRequest;
  config: OrderFormConfig;
  onEdit: (step: ProjectRequestStep) => void;
};

function ReviewBlock({
  title,
  step,
  onEdit,
  children,
}: {
  title: string;
  step: ProjectRequestStep;
  onEdit: (step: ProjectRequestStep) => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-card-border bg-background p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-display text-lg tracking-tight">{title}</h3>
        <Button variant="ghost" size="md" onClick={() => onEdit(step)}>
          Edit
        </Button>
      </div>
      <dl className="grid gap-4 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

function Item({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs tracking-[0.14em] text-muted uppercase">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm leading-6">{value}</dd>
    </div>
  );
}

function isWideField(step: OrderFormStepConfig, fieldKey: string): boolean {
  const field = step.fields.find((item) => item.fieldKey === fieldKey);
  return (
    field?.inputType === "textarea" ||
    field?.constraints.span === "full" ||
    field?.constraints.span === 2
  );
}

export function StepReview({ data, config, onEdit }: Props) {
  return (
    <div className="grid gap-4">
      {config.steps.map((step, index) => {
        if (step.isReview) {
          return null;
        }

        const visibleFields = step.fields.filter((field) =>
          isFieldVisible(field, data),
        );
        const referralField = visibleFields.find((field) =>
          isReferralFieldKey(field.fieldKey),
        );
        const referralCode = referralField
          ? normalizeReferralCode(getStringValue(data, referralField.fieldKey))
          : "";

        return (
          <ReviewBlock
            key={step.id}
            title={step.title}
            step={index + 1}
            onEdit={onEdit}
          >
            {visibleFields.map((field) => (
              <Item
                key={field.id}
                label={field.label}
                value={displayFieldValue(field, data)}
                wide={isWideField(step, field.fieldKey)}
              />
            ))}
            {referralCode ? (
              <Item
                label="Verification"
                value="Referral code will be verified before the discount is applied."
              />
            ) : null}
          </ReviewBlock>
        );
      })}
    </div>
  );
}
