import {
  CheckboxGroup,
  Field,
  SelectInput,
  TextArea,
} from "@/components/ui/form-field";
import { featureOptions, pageCountOptions } from "@/data/project-request";
import type {
  ProjectFeature,
  ProjectRequest,
  ProjectRequestErrors,
} from "@/types/project-request";

type Props = {
  data: ProjectRequest;
  errors: ProjectRequestErrors;
  onChange: <K extends keyof ProjectRequest>(
    field: K,
    value: ProjectRequest[K],
  ) => void;
};

export function StepRequirements({ data, errors, onChange }: Props) {
  return (
    <div className="grid gap-8">
      <Field id="pageCount" label="Number of pages">
        <SelectInput
          id="pageCount"
          name="pageCount"
          value={data.pageCount}
          onChange={(event) => onChange("pageCount", event.target.value)}
        >
          <option value="">Select an estimate</option>
          {pageCountOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </SelectInput>
      </Field>

      <Field
        id="description"
        label="Project description"
        required
        error={errors.description}
        hint="What should the site do, who is it for, and what does success look like?"
      >
        <TextArea
          id="description"
          name="description"
          value={data.description}
          onChange={(event) => onChange("description", event.target.value)}
          error={errors.description}
        />
      </Field>

      <CheckboxGroup<ProjectFeature>
        legend="Required features"
        name="features"
        options={featureOptions}
        values={data.features}
        onChange={(values) => onChange("features", values)}
      />

      <Field
        id="additionalRequirements"
        label="Additional requirements"
        hint="Anything else I should know — integrations, languages, content, or constraints."
      >
        <TextArea
          id="additionalRequirements"
          name="additionalRequirements"
          value={data.additionalRequirements}
          onChange={(event) =>
            onChange("additionalRequirements", event.target.value)
          }
        />
      </Field>
    </div>
  );
}
