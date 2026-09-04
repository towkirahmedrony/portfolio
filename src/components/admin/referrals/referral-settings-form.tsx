import { ActionForm, SubmitButton } from "@/components/admin/projects/action-form";
import { updateReferralSettings } from "@/lib/admin-referral-actions";
import {
  REFERRAL_DEFAULT_CLIENT_DISCOUNT_PERCENT,
  REFERRAL_DEFAULT_REFERRER_REWARD_PERCENT,
  REFERRAL_PERCENT_MAX,
  REFERRAL_PERCENT_MIN,
  REFERRAL_VALIDITY_DAYS_MAX,
  REFERRAL_VALIDITY_DAYS_MIN,
  type ReferralProgramSettings,
} from "@/lib/referral-rules";

const fieldClass =
  "w-full rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground";

export function ReferralSettingsForm({
  settings,
  usingDefaults,
}: {
  settings: ReferralProgramSettings;
  usingDefaults: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      {usingDefaults ? (
        <p className="mb-4 rounded-xl border border-dashed border-card-border bg-card px-4 py-3 text-sm text-muted">
          No saved settings row exists yet — the built-in defaults (
          {REFERRAL_DEFAULT_CLIENT_DISCOUNT_PERCENT}% new-client discount /{" "}
          {REFERRAL_DEFAULT_REFERRER_REWARD_PERCENT}% referrer reward) are
          currently in effect. Saving will create one.
        </p>
      ) : null}

      <ActionForm
        action={updateReferralSettings}
        successMessage="Referral settings saved."
        className="rounded-3xl border border-card-border bg-card p-6"
      >
        <h3 className="font-display mb-1 text-lg text-foreground">Program settings</h3>
        <p className="mb-5 text-sm text-muted">
          Percentages are validated (0–100) and written through an admin-only
          database function. Defaults are only preserved when no row exists.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span>New client discount %</span>
            <input
              name="clientDiscountPercent"
              type="number"
              inputMode="decimal"
              step="0.01"
              min={REFERRAL_PERCENT_MIN}
              max={REFERRAL_PERCENT_MAX}
              defaultValue={settings.newClientDiscountPercent}
              required
              className={fieldClass}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span>Referrer reward %</span>
            <input
              name="referrerRewardPercent"
              type="number"
              inputMode="decimal"
              step="0.01"
              min={REFERRAL_PERCENT_MIN}
              max={REFERRAL_PERCENT_MAX}
              defaultValue={settings.referrerRewardPercent}
              required
              className={fieldClass}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span>Minimum project amount</span>
            <input
              name="minimumProjectAmount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              placeholder="Leave empty for none"
              defaultValue={settings.minimumProjectAmount ?? ""}
              className={fieldClass}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span>Reward validity (days)</span>
            <input
              name="rewardValidityDays"
              type="number"
              inputMode="numeric"
              step="1"
              min={REFERRAL_VALIDITY_DAYS_MIN}
              max={REFERRAL_VALIDITY_DAYS_MAX}
              placeholder="Leave empty for none"
              defaultValue={settings.rewardValidityDays ?? ""}
              className={fieldClass}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span>Program state</span>
            <select name="isActive" defaultValue={settings.isActive ? "true" : "false"} className={fieldClass}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
        </div>

        <p className="mt-4 text-xs leading-5 text-muted">
          Reward validity and minimum project amount may be left empty (no
          limit). Validity, when set, must be a whole number of days between{" "}
          {REFERRAL_VALIDITY_DAYS_MIN} and {REFERRAL_VALIDITY_DAYS_MAX}.
        </p>

        <div className="mt-5">
          <SubmitButton>Save settings</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
