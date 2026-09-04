import { ReferralSettingsForm } from "@/components/admin/referrals/referral-settings-form";
import { QueryStateNotice } from "@/components/admin/projects/query-state";
import { getReferralSettings } from "@/lib/admin-referrals";
import { toReferralProgramSettings } from "@/lib/referral-rules";

/**
 * Reusable section: wraps the shared referral settings form + rules module so
 * the settings page and /admin/referrals/settings stay in lockstep.
 */
export async function ReferralSettingsSection() {
  const settingsResult = await getReferralSettings();

  if (settingsResult.status === "error" || settingsResult.status === "unavailable") {
    return <QueryStateNotice result={settingsResult} />;
  }

  return (
    <ReferralSettingsForm
      settings={toReferralProgramSettings(settingsResult.data)}
      usingDefaults={settingsResult.data === null}
    />
  );
}
