import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { getStringValue, isFieldVisible } from "@/lib/order-form";
import {
  displayFieldValue,
  isReferralFieldKey,
  normalizeReferralCode,
} from "@/lib/project-request";
import { formatFileSize } from "@/lib/project-request-files";
import type { PendingProjectRequestFile } from "@/components/project-request/file-upload-field";
import type { ProjectRequestFileSummary } from "@/lib/project-request-files";
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
  existingFiles?: ProjectRequestFileSummary[];
  pendingFiles?: PendingProjectRequestFile[];
  filesStep?: ProjectRequestStep;
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

export function StepReview({
  data,
  config,
  onEdit,
  existingFiles = [],
  pendingFiles = [],
  filesStep = 1,
}: Props) {
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
            {visibleFields.map((field) => {
              if (field.inputType === "file") {
                const names = [
                  ...existingFiles
                    .filter((file) => (file.form_field_key ?? "") === field.fieldKey)
                    .map(
                      (file) =>
                        `${file.original_name} (${formatFileSize(file.file_size_bytes)})`,
                    ),
                  ...pendingFiles
                    .filter((item) => item.fieldKey === field.fieldKey)
                    .map(
                      (item) =>
                        `${item.file.name} (${formatFileSize(item.file.size)})`,
                    ),
                ];
                if (names.length === 0) {
                  return null;
                }
                return (
                  <Item
                    key={field.id}
                    label={field.label}
                    value={names.join("\n")}
                    wide
                  />
                );
              }
              return (
                <Item
                  key={field.id}
                  label={field.label}
                  value={displayFieldValue(field, data)}
                  wide={isWideField(step, field.fieldKey)}
                />
              );
            })}
            {referralCode ? (
              <Item
                label="Verification"
                value="Referral code will be verified before the discount is applied."
              />
            ) : null}
          </ReviewBlock>
        );
      })}
      {existingFiles.some((file) => !file.form_field_key) ||
      pendingFiles.some((item) => !item.fieldKey) ? (
        <ReviewBlock
          title="Attachments"
          step={filesStep}
          onEdit={onEdit}
        >
          <Item
            label="Files"
            wide
            value={[
              ...existingFiles
                .filter((file) => !file.form_field_key)
                .map(
                  (file) =>
                    `${file.original_name} (${formatFileSize(file.file_size_bytes)})`,
                ),
              ...pendingFiles
                .filter((item) => !item.fieldKey)
                .map(
                  (item) =>
                    `${item.file.name} (${formatFileSize(item.file.size)})`,
                ),
            ].join("\n")}
          />
        </ReviewBlock>
      ) : null}
    </div>
  );
}
