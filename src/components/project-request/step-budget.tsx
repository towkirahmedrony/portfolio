import { ChoiceGroup, Field, TextInput } from "@/components/ui/form-field";
import { budgetOptions, deadlineOptions } from "@/data/project-request";
import type {
  BudgetRange,
  Deadline,
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

export function StepBudget({ data, errors, onChange }: Props) {
  return (
    <div className="grid gap-8">
      <ChoiceGroup<BudgetRange>
        legend="Estimated budget"
        name="budget"
        options={budgetOptions}
        value={data.budget}
        onChange={(value) => onChange("budget", value)}
        columns={2}
      />
      <ChoiceGroup<Deadline>
        legend="Expected deadline"
        name="deadline"
        options={deadlineOptions}
        value={data.deadline}
        onChange={(value) => onChange("deadline", value)}
        columns={2}
      />
      {data.deadline === "specific" ? (
        <Field
          id="specificDate"
          label="Specific date"
          required
          error={errors.specificDate}
        >
          <TextInput
            id="specificDate"
            name="specificDate"
            type="date"
            value={data.specificDate}
            onChange={(event) => onChange("specificDate", event.target.value)}
            error={errors.specificDate}
          />
        </Field>
      ) : null}
    </div>
  );
}
