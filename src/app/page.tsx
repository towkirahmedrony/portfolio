import type { Metadata } from "next";
import { Suspense } from "react";
import { CallToAction } from "@/components/cta";
import { ProjectCard } from "@/components/project-card";
import {
  ContentStateMessage,
  HomeCardSkeleton,
  ProjectGridSkeleton,
} from "@/components/public/content-states";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { processSteps } from "@/data/process";
import { site } from "@/data/site";
import { reasons } from "@/data/skills";
import {
  getPublicProjects,
  getPublicServices,
  HOME_PROJECTS_LIMIT,
} from "@/lib/public-content";
import type { Service } from "@/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${site.name} — Freelance Web Developer`,
  description: site.tagline,
  openGraph: {
    title: `${site.name} — Freelance Web Developer`,
    description: site.tagline,
  },
};

function HomeServiceCard({ service }: { service: Service }) {
  const blurb = service.shortDescription || service.description;

  return (
    <Card>
      <h3 className="font-display text-xl tracking-tight">{service.title}</h3>
      {blurb ? (
        <p className="mt-3 text-sm leading-6 text-muted">{blurb}</p>
      ) : null}
    </Card>
  );
}

async function HomeServicesContent() {
  const result = await getPublicServices();

  if (result.status === "ok") {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {result.data.map((service) => (
          <HomeServiceCard key={service.id} service={service} />
        ))}
      </div>
    );
  }

  if (result.status === "empty") {
    return (
      <ContentStateMessage>
        Services are not published yet. Check back soon.
      </ContentStateMessage>
    );
  }

  return (
    <ContentStateMessage>
      The services overview is temporarily unavailable. Please try again shortly.
    </ContentStateMessage>
  );
}

async function HomeFeaturedWorkContent() {
  const result = await getPublicProjects({ limit: HOME_PROJECTS_LIMIT });

  if (result.status === "ok") {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {result.data.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    );
  }

  if (result.status === "empty") {
    return (
      <ContentStateMessage>
        No published projects yet. Check back soon for new work.
      </ContentStateMessage>
    );
  }

  return (
    <ContentStateMessage>
      The featured work is temporarily unavailable. Please try again shortly.
    </ContentStateMessage>
  );
}

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden pt-28 pb-20 sm:pt-36 sm:pb-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--accent-soft),_transparent_55%)]" />
        <div className="relative mx-auto w-full max-w-6xl px-5 sm:px-8">
          <p className="animate-fade-up text-xs font-medium tracking-[0.22em] text-accent uppercase">
            {site.role}
          </p>
          <h1 className="font-display animate-fade-up mt-4 max-w-3xl text-4xl leading-[1.1] tracking-tight text-balance sm:text-6xl">
            {site.name}
          </h1>
          <p
            className="animate-fade-up mt-6 max-w-xl text-lg leading-8 text-muted"
            style={{ animationDelay: "80ms" }}
          >
            {site.tagline}
          </p>
          <div
            className="animate-fade-up mt-8 flex flex-col gap-3 sm:flex-row"
            style={{ animationDelay: "140ms" }}
          >
            <ButtonLink href="/start-project" size="lg">
              Start a Project
            </ButtonLink>
            <ButtonLink href="/projects" variant="secondary" size="lg">
              View My Work
            </ButtonLink>
          </div>
        </div>
      </section>

      <Section
        id="services"
        eyebrow="Services"
        title="Websites that look considered and work hard."
        description="From a first company site to a custom application, each engagement is scoped around clarity, performance, and a result you can stand behind."
      >
        <Suspense fallback={<HomeCardSkeleton />}>
          <HomeServicesContent />
        </Suspense>
      </Section>

      <Section
        id="work"
        eyebrow="Selected work"
        title="Featured projects"
        description="A few recent builds across business sites, commerce, landing pages, and product interfaces."
        actions={
          <ButtonLink href="/projects" variant="secondary">
            See all projects
          </ButtonLink>
        }
      >
        <Suspense fallback={<ProjectGridSkeleton />}>
          <HomeFeaturedWorkContent />
        </Suspense>
      </Section>

      <Section
        id="why"
        eyebrow="Approach"
        title="Why choose me"
        description="A small, focused practice — so you work directly with the person designing and shipping the site."
      >
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {reasons.map((reason) => (
            <Card key={reason.title}>
              <h3 className="font-display text-lg tracking-tight">
                {reason.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-muted">
                {reason.description}
              </p>
            </Card>
          ))}
        </div>
      </Section>

      <Section
        id="process"
        eyebrow="Process"
        title="How a project typically unfolds"
        description="A clear sequence from first conversation to launch — with room to adapt as the brief evolves."
      >
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {processSteps.map((item) => (
            <li key={item.step}>
              <Card>
                <p className="text-xs font-medium tracking-[0.2em] text-accent">
                  {item.step}
                </p>
                <h3 className="font-display mt-3 text-xl tracking-tight">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-muted">
                  {item.description}
                </p>
              </Card>
            </li>
          ))}
        </ol>
      </Section>

      <CallToAction />
    </>
  );
}
