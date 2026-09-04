import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { CustomerProfile } from "@/components/profile/customer-profile";
import { ProjectTracking } from "@/components/profile/project-tracking";
import { ReferralSection } from "@/components/profile/referral-section";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { mapProfileRow, mapReferralCode } from "@/lib/profile";
import type { ProfileRow } from "@/types/database";

export const dynamic = "force-dynamic";

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

  const { data: profileData } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const { data: referralRow } = await supabase.from("referral_codes").select("code").eq("owner_id", user.id).eq("is_active", true).order("created_at", { ascending: true }).limit(1).maybeSingle();

  const mapped = mapProfileRow((profileData || { id: user.id }) as ProfileRow, user.email ?? "");
  const referral = mapReferralCode(referralRow?.code ?? null);

  return (
    <section className="py-12 sm:py-16 mt-8 sm:mt-12">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div className="grid gap-5">
          <CustomerProfile initialProfile={mapped.profile} initialAccount={mapped.account} />
          {/* Server Component as child */}
          <ProjectTracking />
          <ReferralSection referral={referral} />
        </div>
      </div>
    </section>
  );
}
