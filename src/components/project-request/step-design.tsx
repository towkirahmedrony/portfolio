import {
  ChoiceGroup,
  Field,
  TextArea,
  TextInput,
} from "@/components/ui/form-field";
import { designStyleOptions, yesNoOptions } from "@/data/project-request";
import type {
  DesignStyle,
  ProjectRequest,
  YesNo,
} from "@/types/project-request";

type Props = {
  data: ProjectRequest;
  onChange: <K extends keyof ProjectRequest>(
    field: K,
    value: ProjectRequest[K],
  ) => void;
};

export function StepDesign({ data, onChange }: Props) {
  return (
    <div className="grid gap-8">
      <ChoiceGroup<YesNo>
        legend="Do you already have a design / Figma?"
        name="hasDesign"
        options={yesNoOptions}
        value={data.hasDesign}
        onChange={(value) => onChange("hasDesign", value)}
        columns={2}
      />

      <Field
        id="referenceUrls"
        label="Reference website URLs"
        hint="One per line is fine."
      >
        <TextArea
          id="referenceUrls"
          name="referenceUrls"
          value={data.referenceUrls}
          onChange={(event) => onChange("referenceUrls", event.target.value)}
        />
      </Field>

      <ChoiceGroup<DesignStyle>
        legend="Preferred design style"
        name="designStyle"
        options={designStyleOptions}
        value={data.designStyle}
        onChange={(value) => onChange("designStyle", value)}
        columns={3}
      />

      {data.designStyle === "other" ? (
        <Field id="designStyleOther" label="Describe the style">
          <TextInput
            id="designStyleOther"
            name="designStyleOther"
            value={data.designStyleOther}
            onChange={(event) =>
              onChange("designStyleOther", event.target.value)
            }
          />
        </Field>
      ) : null}

      <div className="grid gap-8 sm:grid-cols-2">
        <ChoiceGroup<YesNo>
          legend="Do you have a logo?"
          name="hasLogo"
          options={yesNoOptions}
          value={data.hasLogo}
          onChange={(value) => onChange("hasLogo", value)}
          columns={1}
        />
        <ChoiceGroup<YesNo>
          legend="Do you have brand colors?"
          name="hasBrandColors"
          options={yesNoOptions}
          value={data.hasBrandColors}
          onChange={(value) => onChange("hasBrandColors", value)}
          columns={1}
        />
      </div>
    </div>
  );
}
