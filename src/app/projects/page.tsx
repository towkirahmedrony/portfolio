import type { Metadata } from "next";
import { CallToAction } from "@/components/cta";
import { ProjectGrid } from "@/components/project-grid";
import { PageHero, Section } from "@/components/ui/section";

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

export default function ProjectsPage() {
  return (
    <>
      <PageHero
        eyebrow="Work"
        title="Projects"
        description="A selection of websites and applications built for studios, brands, and teams. Filter by type if you want to see a specific kind of work."
      />
      <Section className="pt-12 sm:pt-16">
        <ProjectGrid />
      </Section>
      <CallToAction title="Want something in this direction?" />
    </>
  );
}
