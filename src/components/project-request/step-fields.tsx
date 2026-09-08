import type { ReactNode } from "react";
import { OrderFormFieldControl } from "@/components/project-request/order-form-field";
import { fieldDependsOn, isFieldVisible } from "@/lib/order-form";
import type {
  OrderFormConfig,
  OrderFormFieldConfig,
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
  extra?: ReactNode;
  renderFieldControl?: (field: OrderFormFieldConfig) => ReactNode;
};

export function StepFields({
  step,
  config,
  data,
  errors,
  onChange,
  extra,
  renderFieldControl,
}: Props) {
  const visible = step.fields.filter((field) => isFieldVisible(field, data));
  const nestedIds = new Set<string>();
  const nestedByParent = new Map<string, OrderFormFieldConfig[]>();

  for (const field of visible) {
    const parentKey = fieldDependsOn(field);
    if (!parentKey) {
      continue;
    }
    const parent = visible.find(
      (item) => item.fieldKey === parentKey && item.id !== field.id,
    );
    if (!parent) {
      continue;
    }
    const list = nestedByParent.get(parent.fieldKey) ?? [];
    list.push(field);
    nestedByParent.set(parent.fieldKey, list);
    nestedIds.add(field.id);
  }

  const fields = visible.filter((field) => !nestedIds.has(field.id));
  const usesTwoColumn = fields.some(
    (field) =>
      field.inputType === "text" ||
      field.inputType === "email" ||
      field.inputType === "tel",
  );

  function renderControl(field: OrderFormFieldConfig): ReactNode {
    const nested = nestedByParent.get(field.fieldKey) ?? [];
    const nestedControls =
      nested.length > 0 ? (
        <div className="grid gap-5">
          {nested.map((child) => renderControl(child))}
        </div>
      ) : null;

    if (renderFieldControl && field.inputType === "file") {
      return (
        <div key={field.id}>
          {renderFieldControl(field)}
        </div>
      );
    }

    return (
      <OrderFormFieldControl
        key={field.id}
        field={field}
        config={config}
        data={data}
        errors={errors}
        onChange={onChange}
        extra={
          nestedControls || (field.inputType !== "file" ? renderFieldControl?.(field) : null)
        }
      />
    );
  }

  return (
    <div className={usesTwoColumn ? "grid gap-5 sm:grid-cols-2" : "grid gap-8"}>
      {fields.map((field) => renderControl(field))}
      {extra}
    </div>
  );
}
