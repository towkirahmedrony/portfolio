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

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Projects",
  description:
    "Selected freelance web projects including business websites, e-commerce storefronts, landing pages, portfolios, and custom applications.",
  openGraph: {
    title: "Projects",
    description:
      "Selected freelance web projects including business websites, e-commerce storefronts, landing pages, portfolios, and custom applications.",
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
        description="A selection of websites and applications built for studios, brands, and teams. Filter by type if you want to see a specific kind of work."
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
