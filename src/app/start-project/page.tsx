import type { Metadata } from "next";
import { ProjectRequestForm } from "@/components/project-request/project-request-form";
import { PageHero } from "@/components/ui/section";

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

export default function StartProjectPage() {
  return (
    <>
      <PageHero
        eyebrow="Project request"
        title="Tell me about the website you need"
        description="Six short steps. Your answers stay on this page until you submit — nothing is stored or emailed yet."
      />
      <section className="py-12 sm:py-16">
        <div className="mx-auto w-full max-w-3xl px-5 sm:px-8">
          <ProjectRequestForm />
        </div>
      </section>
    </>
  );
}
