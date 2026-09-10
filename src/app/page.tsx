import type { Metadata } from "next";
import { Suspense } from "react";
import { CallToAction } from "@/components/cta";
import { FaqSection } from "@/components/faq";
import { ProjectCard } from "@/components/project-card";
import { PublicReviewsSection } from "@/components/reviews/reviews-section";
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
import { pageMetadata } from "@/lib/seo";
import type { Service } from "@/types";

// Public marketing page: projects, services and published reviews are
// CMS-managed, rarely changing content. Serve from the Next.js cache (ISR)
// with a one-hour fallback TTL; admin mutations revalidate "/", "/projects"
// and "/services" on demand, so edits appear without a per-visitor
// Supabase round-trip.
export const revalidate = 3600;

export const metadata: Metadata = pageMetadata({
  title: "Freelance Web Developer — Websites & Web Applications",
  absoluteTitle: "Freelance Web Developer — Websites & Web Applications",
  description: site.description,
  path: "/",
});

function HomeServiceCard({ service }: { service: Service }) {
  const blurb = service.shortDescription || service.description;

  return (
    <Card>
      {service.image ? (
        <div className="relative mb-4 aspect-[16/9] overflow-hidden rounded-2xl bg-accent-soft">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={service.image}
            alt={`${service.title} overview`}
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}
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
      <div className="grid gap-5 sm:grid-cols-2">
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
      <div className="grid min-w-0 gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
          <h1 className="font-display animate-fade-up mt-4 max-w-4xl text-4xl leading-[1.1] tracking-tight text-balance sm:text-6xl">
            {site.headline}
          </h1>
          <p
            className="animate-fade-up mt-6 max-w-2xl text-lg leading-8 text-muted"
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
          <p
            className="animate-fade-up mt-5 text-sm text-muted"
            style={{ animationDelay: "180ms" }}
          >
            Prefer to ask first?{" "}
            <a
              href="/ai-assistant"
              className="font-medium text-foreground underline decoration-card-border underline-offset-4 transition-colors hover:decoration-accent"
            >
              Open the project assistant
            </a>
          </p>
        </div>
      </section>

      <Section
        id="services"
        eyebrow="Services"
        title="What I can build for you"
        description="Website development for a clear public presence, and web application development for products, dashboards, and real workflows."
      >
        <Suspense fallback={<HomeCardSkeleton />}>
          <HomeServicesContent />
        </Suspense>
      </Section>

      <Section
        id="work"
        eyebrow="Selected work"
        title="Featured projects"
        description="A selection of websites and web applications — what they are, what was built, and how they work."
        actions={
          <ButtonLink href="/projects" variant="secondary">
            View My Work
          </ButtonLink>
        }
      >
        <Suspense fallback={<ProjectGridSkeleton />}>
          <HomeFeaturedWorkContent />
        </Suspense>
      </Section>

      <PublicReviewsSection />

      <Section
        id="why"
        eyebrow="Approach"
        title="How the work is built"
        description="Clear structure, pages that hold up on every screen, and a first version you can actually use."
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

      <FaqSection description="A few practical answers before we start. Anything that depends on the project is agreed in the brief." />

      <CallToAction
        title="Have a project in mind?"
        description="Let's discuss what you want to build — a website, a web application, or an improvement to an existing site."
      />
    </>
  );
}
