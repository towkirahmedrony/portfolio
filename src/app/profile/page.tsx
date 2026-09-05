import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { CustomerProfile } from "@/components/profile/customer-profile";
import { CustomerRequests } from "@/components/profile/customer-requests";
import { ProjectTracking } from "@/components/profile/project-tracking";
import { ReferralSection } from "@/components/profile/referral-section";
import { getCustomerProjectRequests } from "@/lib/customer-project-requests";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buildCustomerReferral, mapProfileRow } from "@/lib/profile";
import type { ProfileRow } from "@/types/database";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Customer Profile",
  description: "View and update your customer profile, account details, and referral information.",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  try { await supabase.rpc("sync_customer_session"); } catch {}

  const [
    { data: profileData },
    { data: codeRows },
    { data: referralRows },
    { data: rewardRows },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("referral_codes")
      .select("code, is_active")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true })
      .limit(10),
    supabase
      .from("referrals")
      .select("id, status, referrer_reward_percent, created_at")
      .eq("referrer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("referral_rewards")
      .select("id, reward_percent, status, expires_at")
      .eq("referrer_id", user.id)
      .eq("status", "available"),
  ]);

  // The auth lifecycle trigger normally guarantees a profiles row. If it is
  // missing, derive the initial display values from the authenticated session
  // (same source the DB trigger uses) instead of inventing customer data.
  const meta = user.user_metadata ?? {};
  const email = user.email ?? "";
  const fallbackProfile: ProfileRow = {
    id: user.id,
    full_name: String(meta.full_name ?? meta.name ?? email.split("@")[0] ?? ""),
    display_name: meta.display_name ?? null,
    avatar_url: meta.avatar_url ?? meta.picture ?? null,
    phone: null,
    company_name: null,
    job_title: null,
    role: "client",
    status: "active",
    email_verified: false,
    created_at: user.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_seen_at: null,
  };

  const mapped = mapProfileRow((profileData ?? fallbackProfile) as ProfileRow, email);
  const referral = buildCustomerReferral({
    codes: codeRows,
    referrals: referralRows,
    availableRewards: rewardRows,
  });
  const requestItems = await getCustomerProjectRequests(user.id);

  return (
    <section className="py-12 sm:py-16 mt-8 sm:mt-12">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div className="grid gap-5">
          <CustomerProfile initialProfile={mapped.profile} initialAccount={mapped.account} />
          <CustomerRequests items={requestItems} />
          <ProjectTracking />
          <ReferralSection referral={referral} />
        </div>
      </div>
    </section>
  );
}
