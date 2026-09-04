import {
  CheckboxGroup,
  ChoiceGroup,
  Field,
  SelectInput,
  TextArea,
  TextInput,
} from "@/components/ui/form-field";
import {
  fieldNeedsDateInput,
  fieldNeedsOtherInput,
  getListValue,
  getStringValue,
  otherValueKey,
  radioColumns,
} from "@/lib/order-form";
import { isReferralFieldKey } from "@/lib/project-request";
import type {
  OrderFormConfig,
  OrderFormFieldConfig,
  ProjectRequest,
  ProjectRequestErrors,
} from "@/types/project-request";

type Props = {
  field: OrderFormFieldConfig;
  data: ProjectRequest;
  errors: ProjectRequestErrors;
  config: OrderFormConfig;
  onChange: (fieldKey: string, value: string | string[]) => void;
};

function autoCompleteFor(field: OrderFormFieldConfig): string | undefined {
  if (field.fieldKey === "full_name" || field.fieldKey === "fullName") {
    return "name";
  }
  if (field.fieldKey === "email") {
    return "email";
  }
  if (field.fieldKey === "phone") {
    return "tel";
  }
  if (field.fieldKey === "company_name" || field.fieldKey === "company") {
    return "organization";
  }
  if (isReferralFieldKey(field.fieldKey)) {
    return "off";
  }
  return undefined;
}

function gridClass(field: OrderFormFieldConfig): string | undefined {
  const span = field.constraints.span ?? field.constraints.full_width;
  if (
    span === "full" ||
    span === 2 ||
    span === true ||
    field.inputType === "textarea" ||
    isReferralFieldKey(field.fieldKey)
  ) {
    return "sm:col-span-2";
  }
  return undefined;
}

export function OrderFormFieldControl({
  field,
  data,
  errors,
  config,
  onChange,
}: Props) {
  const error = errors[field.fieldKey];
  const otherKey = otherValueKey(field.fieldKey);
  const followUp = config.fields.find(
    (item) =>
      item.fieldKey === otherKey ||
      item.fieldKey === `${field.fieldKey}_other` ||
      item.fieldKey === `${field.fieldKey}Other`,
  );
  const showInlineOther =
    fieldNeedsOtherInput(field, data) &&
    !followUp &&
    (field.inputType === "radio" || field.inputType === "select");
  const dateFollowUp = config.fields.find(
    (item) =>
      item.inputType === "date" &&
      (item.fieldKey === "deadline_date" ||
        item.fieldKey === "specific_date" ||
        item.fieldKey === "specificDate"),
  );
  const showInlineDate =
    fieldNeedsDateInput(field, data) && !dateFollowUp;
  const wrapperClass = gridClass(field);
  const options = field.options.map((option) => ({
    value: option.slug,
    label: option.label,
    description: option.description ?? undefined,
  }));

  let control = null;

  if (field.inputType === "radio") {
    control = (
      <ChoiceGroup
        legend={field.label}
        name={field.fieldKey}
        options={options}
        value={getStringValue(data, field.fieldKey)}
        onChange={(value) => onChange(field.fieldKey, value)}
        required={field.required}
        error={error}
        columns={radioColumns(field)}
      />
    );
  } else if (field.inputType === "checkbox_group") {
    control = (
      <CheckboxGroup
        legend={field.label}
        name={field.fieldKey}
        options={options}
        values={getListValue(data, field.fieldKey)}
        onChange={(values) => onChange(field.fieldKey, values)}
        error={error}
      />
    );
  } else if (field.inputType === "select") {
    control = (
      <Field
        id={field.fieldKey}
        label={field.label}
        required={field.required}
        hint={field.hint ?? undefined}
        error={error}
      >
        <SelectInput
          id={field.fieldKey}
          name={field.fieldKey}
          value={getStringValue(data, field.fieldKey)}
          onChange={(event) => onChange(field.fieldKey, event.target.value)}
          error={error}
        >
          <option value="">{field.placeholder || "Select an option"}</option>
          {field.options.map((option) => (
            <option key={option.slug} value={option.slug}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </Field>
    );
  } else if (field.inputType === "textarea") {
    control = (
      <Field
        id={field.fieldKey}
        label={field.label}
        required={field.required}
        hint={field.hint ?? undefined}
        error={error}
      >
        <TextArea
          id={field.fieldKey}
          name={field.fieldKey}
          value={getStringValue(data, field.fieldKey)}
          onChange={(event) => onChange(field.fieldKey, event.target.value)}
          placeholder={field.placeholder ?? undefined}
          error={error}
        />
      </Field>
    );
  } else {
    const referral = isReferralFieldKey(field.fieldKey);
    control = (
      <Field
        id={field.fieldKey}
        label={field.label}
        required={field.required}
        hint={field.hint ?? undefined}
        error={error}
      >
        <TextInput
          id={field.fieldKey}
          name={field.fieldKey}
          type={
            field.inputType === "email" ||
            field.inputType === "tel" ||
            field.inputType === "date"
              ? field.inputType
              : "text"
          }
          autoComplete={autoCompleteFor(field)}
          autoCapitalize={referral ? "characters" : undefined}
          spellCheck={referral ? false : undefined}
          value={getStringValue(data, field.fieldKey)}
          onChange={(event) => onChange(field.fieldKey, event.target.value)}
          onBlur={
            referral
              ? (event) =>
                  onChange(field.fieldKey, event.target.value.trim())
              : undefined
          }
          placeholder={field.placeholder ?? undefined}
          error={error}
          className={referral ? "uppercase tracking-[0.08em]" : undefined}
        />
      </Field>
    );
  }

  return (
    <div className={wrapperClass}>
      {control}
      {showInlineOther ? (
        <div className="mt-5">
          <Field
            id={otherKey}
            label={`Describe ${field.label.toLowerCase()}`}
            error={errors[otherKey]}
          >
            <TextInput
              id={otherKey}
              name={otherKey}
              value={getStringValue(data, otherKey)}
              onChange={(event) => onChange(otherKey, event.target.value)}
              error={errors[otherKey]}
            />
          </Field>
        </div>
      ) : null}
      {showInlineDate ? (
        <div className="mt-5">
          <Field
            id={otherKey}
            label="Specific date"
            required
            error={errors[otherKey]}
          >
            <TextInput
              id={otherKey}
              name={otherKey}
              type="date"
              value={getStringValue(data, otherKey)}
              onChange={(event) => onChange(otherKey, event.target.value)}
              error={errors[otherKey]}
            />
          </Field>
        </div>
      ) : null}
    </div>
  );
}
