import type { Metadata } from "next";
import { ProjectRequestForm } from "@/components/project-request/project-request-form";
import { ContentStateMessage } from "@/components/public/content-states";
import { PageHero } from "@/components/ui/section";
import {
  getOrderFormConfig,
  resolveServiceId,
} from "@/lib/order-form-server";
import { parseStartProjectSearchParams } from "@/lib/order-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Start a Project",
  description:
    "Share your website requirements in a short brief. I will review the details and follow up with a practical next step.",
  openGraph: {
    title: "Start a Project",
    description:
      "Share your website requirements in a short brief. I will review the details and follow up with a practical next step.",
  },
};

export default async function StartProjectPage({
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
  const [configResult, serviceId] = await Promise.all([
    getOrderFormConfig(),
    resolveServiceId(serviceParam),
  ]);

  return (
    <>
      <PageHero
        eyebrow="Project request"
        title="Tell me about the website you need"
        description="A short brief, one step at a time. Your answers stay on this page until you submit — nothing is stored or emailed yet."
      />
      <section className="py-12 sm:py-16">
        <div className="mx-auto w-full max-w-3xl px-5 sm:px-8">
          {configResult.status === "ok" ? (
            <ProjectRequestForm
              config={configResult.data}
              serviceId={serviceId}
              initialReferralCode={referralCode}
            />
          ) : configResult.status === "empty" ? (
            <ContentStateMessage>
              The project request form is not available yet. Please check back
              soon.
            </ContentStateMessage>
          ) : (
            <ContentStateMessage>
              The project request form is temporarily unavailable. Please try
              again shortly.
            </ContentStateMessage>
          )}
        </div>
      </section>
    </>
  );
}
