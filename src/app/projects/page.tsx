import type { Metadata } from "next";
import { Suspense } from "react";
import { CallToAction } from "@/components/cta";
import { ProjectGrid } from "@/components/project-grid";
import {
  ContentStateMessage,
  ProjectGridSkeleton,
} from "@/components/public/content-states";
import { PageHero, Section } from "@/components/ui/section";
import { getPublicProjects } from "@/lib/public-content";

// Public marketing page: published portfolio projects change rarely. Serve
// from the Next.js cache (ISR) with a one-hour fallback TTL; admin portfolio
// mutations revalidate "/" and "/projects" on demand.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Projects",
  description:
    "Selected websites and web applications, with factual descriptions of what was built and the technologies used.",
  openGraph: {
    title: "Projects",
    description:
      "Selected websites and web applications, with factual descriptions of what was built and the technologies used.",
  },
};

async function ProjectsContent() {
  const result = await getPublicProjects();

  if (result.status === "ok") {
    return <ProjectGrid projects={result.data} />;
  }

  if (result.status === "empty") {
    return (
      <ContentStateMessage>
        No projects have been published yet. Check back soon for new work.
      </ContentStateMessage>
    );
  }

  return (
    <ContentStateMessage>
      The project gallery is temporarily unavailable. Please try again shortly.
    </ContentStateMessage>
  );
}

export default function ProjectsPage() {
  return (
    <>
      <PageHero
        eyebrow="Work"
        title="Projects"
        description="A selection of websites and web applications. Each project includes a short description of what was built, the stack, and a live demo when available."
      />
      <Section className="pt-12 sm:pt-16">
        <Suspense fallback={<ProjectGridSkeleton />}>
          <ProjectsContent />
        </Suspense>
      </Section>
      <CallToAction title="Want something in this direction?" />
    </>
  );
}
