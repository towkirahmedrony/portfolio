import { ChoiceGroup } from "@/components/ui/form-field";
import {
  projectTypeOptions,
  websiteStatusOptions,
} from "@/data/project-request";
import type {
  ProjectRequest,
  ProjectRequestErrors,
  ProjectType,
  WebsiteStatus,
} from "@/types/project-request";

type Props = {
  data: ProjectRequest;
  errors: ProjectRequestErrors;
  onChange: <K extends keyof ProjectRequest>(
    field: K,
    value: ProjectRequest[K],
  ) => void;
};

export function StepType({ data, errors, onChange }: Props) {
  return (
    <div className="grid gap-8">
      <ChoiceGroup<ProjectType>
        legend="What type of website do you need?"
        name="projectType"
        options={projectTypeOptions}
        value={data.projectType}
        onChange={(value) => onChange("projectType", value)}
        required
        error={errors.projectType}
        columns={2}
      />
      <ChoiceGroup<WebsiteStatus>
        legend="Is this a new site or a redesign?"
        name="websiteStatus"
        options={websiteStatusOptions}
        value={data.websiteStatus}
        onChange={(value) => onChange("websiteStatus", value)}
        required
        error={errors.websiteStatus}
        columns={2}
      />
    </div>
  );
}
