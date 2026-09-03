import { Field, TextInput } from "@/components/ui/form-field";
import type {
  ProjectRequest,
  ProjectRequestErrors,
} from "@/types/project-request";

type Props = {
  data: ProjectRequest;
  errors: ProjectRequestErrors;
  onChange: (field: keyof ProjectRequest, value: string) => void;
};

export function StepClient({ data, errors, onChange }: Props) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field id="fullName" label="Full Name" required error={errors.fullName}>
        <TextInput
          id="fullName"
          name="fullName"
          autoComplete="name"
          value={data.fullName}
          onChange={(event) => onChange("fullName", event.target.value)}
          error={errors.fullName}
        />
      </Field>
      <Field id="email" label="Email" required error={errors.email}>
        <TextInput
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={data.email}
          onChange={(event) => onChange("email", event.target.value)}
          error={errors.email}
        />
      </Field>
      <Field
        id="phone"
        label="Phone / WhatsApp"
        hint="Optional. Include country code if you prefer WhatsApp."
        error={errors.phone}
      >
        <TextInput
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          value={data.phone}
          onChange={(event) => onChange("phone", event.target.value)}
        />
      </Field>
      <Field id="company" label="Company / Business Name">
        <TextInput
          id="company"
          name="company"
          autoComplete="organization"
          value={data.company}
          onChange={(event) => onChange("company", event.target.value)}
        />
      </Field>
      <div className="sm:col-span-2">
        <Field
          id="referralCode"
          label="Referral Code (Optional)"
          hint="Have a referral code? Enter it here to receive 5% off your first project."
        >
          <TextInput
            id="referralCode"
            name="referralCode"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={data.referralCode}
            onChange={(event) => onChange("referralCode", event.target.value)}
            onBlur={(event) =>
              onChange("referralCode", event.target.value.trim())
            }
            className="uppercase tracking-[0.08em]"
          />
        </Field>
      </div>
    </div>
  );
}
