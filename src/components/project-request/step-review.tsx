import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  budgetOptions,
  deadlineOptions,
  designStyleOptions,
  getOptionLabel,
  projectTypeOptions,
  websiteStatusOptions,
  yesNoOptions,
} from "@/data/project-request";
import { formatFeatureList } from "@/lib/project-request";
import type { ProjectRequest, ProjectRequestStep } from "@/types/project-request";

type Props = {
  data: ProjectRequest;
  onEdit: (step: ProjectRequestStep) => void;
};

function display(value: string): string {
  return value.trim() ? value.trim() : "Not specified";
}

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

export function StepReview({ data, onEdit }: Props) {
  const designStyle =
    data.designStyle === "other" && data.designStyleOther.trim()
      ? data.designStyleOther
      : getOptionLabel(designStyleOptions, data.designStyle);

  const deadline =
    data.deadline === "specific" && data.specificDate
      ? data.specificDate
      : getOptionLabel(deadlineOptions, data.deadline);

  return (
    <div className="grid gap-4">
      <ReviewBlock title="Client information" step={1} onEdit={onEdit}>
        <Item label="Full name" value={display(data.fullName)} />
        <Item label="Email" value={display(data.email)} />
        <Item label="Phone / WhatsApp" value={display(data.phone)} />
        <Item label="Company" value={display(data.company)} />
      </ReviewBlock>

      <ReviewBlock title="Project type" step={2} onEdit={onEdit}>
        <Item
          label="Website type"
          value={getOptionLabel(projectTypeOptions, data.projectType)}
        />
        <Item
          label="Status"
          value={getOptionLabel(websiteStatusOptions, data.websiteStatus)}
        />
      </ReviewBlock>

      <ReviewBlock title="Requirements" step={3} onEdit={onEdit}>
        <Item label="Number of pages" value={display(data.pageCount)} />
        <Item label="Features" value={formatFeatureList(data)} />
        <Item label="Description" value={display(data.description)} wide />
        <Item
          label="Additional requirements"
          value={display(data.additionalRequirements)}
          wide
        />
      </ReviewBlock>

      <ReviewBlock title="Design" step={4} onEdit={onEdit}>
        <Item
          label="Existing design / Figma"
          value={getOptionLabel(yesNoOptions, data.hasDesign)}
        />
        <Item label="Preferred style" value={designStyle} />
        <Item
          label="Logo"
          value={getOptionLabel(yesNoOptions, data.hasLogo)}
        />
        <Item
          label="Brand colors"
          value={getOptionLabel(yesNoOptions, data.hasBrandColors)}
        />
        <Item
          label="Reference URLs"
          value={display(data.referenceUrls)}
          wide
        />
      </ReviewBlock>

      <ReviewBlock title="Budget and timeline" step={5} onEdit={onEdit}>
        <Item
          label="Estimated budget"
          value={getOptionLabel(budgetOptions, data.budget)}
        />
        <Item label="Expected deadline" value={deadline} />
      </ReviewBlock>
    </div>
  );
}
