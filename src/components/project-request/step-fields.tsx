import { OrderFormFieldControl } from "@/components/project-request/order-form-field";
import { isFieldVisible } from "@/lib/order-form";
import type {
  OrderFormConfig,
  OrderFormStepConfig,
  ProjectRequest,
  ProjectRequestErrors,
} from "@/types/project-request";

type Props = {
  step: OrderFormStepConfig;
  config: OrderFormConfig;
  data: ProjectRequest;
  errors: ProjectRequestErrors;
  onChange: (fieldKey: string, value: string | string[]) => void;
};

export function StepFields({ step, config, data, errors, onChange }: Props) {
  const fields = step.fields.filter((field) => isFieldVisible(field, data));
  const usesTwoColumn = fields.some(
    (field) =>
      field.inputType === "text" ||
      field.inputType === "email" ||
      field.inputType === "tel",
  );

  return (
    <div className={usesTwoColumn ? "grid gap-5 sm:grid-cols-2" : "grid gap-8"}>
      {fields.map((field) => (
        <OrderFormFieldControl
          key={field.id}
          field={field}
          config={config}
          data={data}
          errors={errors}
          onChange={onChange}
        />
      ))}
    </div>
  );
}
