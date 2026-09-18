import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectRequestForm } from "@/components/project-request/project-request-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  ContentStateMessage,
  OrderFormSkeleton,
} from "@/components/public/content-states";
import { PageHero } from "@/components/ui/section";
import {
  getOrderFormConfig,
  resolveServiceId,
} from "@/lib/order-form-server";
import { parseStartProjectSearchParams } from "@/lib/order-form";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Start a Project",
  description:
    "Share your website or web app requirements in a short brief. I will review the details and follow up with a practical next step.",
  path: "/start-project",
});

async function StartProjectForm({
  searchParams,
}: {
  searchParams: Promise<{
    ref?: string | string[];
    service?: string | string[];
    service_id?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const { referralCode, serviceParam } = parseStartProjectSearchParams(params);
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("full_name, backup_email")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };
  const initialContact = user
    ? {
        name: profile?.full_name?.trim() || String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? ""),
        email: user.email?.trim() ?? "",
        backupEmail: profile?.backup_email?.trim() ?? "",
      }
    : null;
  const [configResult, serviceId] = await Promise.all([
    getOrderFormConfig(),
    resolveServiceId(serviceParam),
  ]);

  if (configResult.status === "ok") {
    return (
      <ProjectRequestForm
        config={configResult.data}
        serviceId={serviceId}
        initialReferralCode={referralCode}
        initialContact={initialContact}
      />
    );
  }

  if (configResult.status === "empty") {
    return (
      <ContentStateMessage>
        The project request form is not available yet. Please check back soon.
      </ContentStateMessage>
    );
  }

  return (
    <ContentStateMessage>
      The project request form is temporarily unavailable. Please try again
      shortly.
    </ContentStateMessage>
  );
}

export default function StartProjectPage({
  searchParams,
}: {
  searchParams: Promise<{
    ref?: string | string[];
    service?: string | string[];
    service_id?: string | string[];
  }>;
}) {
  return (
    <>
      <PageHero
        eyebrow="Project request"
        title="Tell me about the website or web app you need"
        description="A short brief, one step at a time. Your answers stay on this page until you submit — nothing is stored or emailed yet."
      />
      <section className="py-12 sm:py-16">
        <div className="mx-auto w-full max-w-3xl px-5 sm:px-8">
          <Suspense fallback={<OrderFormSkeleton />}>
            <StartProjectForm searchParams={searchParams} />
          </Suspense>
        </div>
      </section>
    </>
  );
}
