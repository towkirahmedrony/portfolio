import type { Metadata } from "next";
import { Suspense } from "react";
import { CallToAction } from "@/components/cta";
import { FaqSection } from "@/components/faq";
import {
  ContentStateMessage,
  ServiceListSkeleton,
} from "@/components/public/content-states";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHero, Section } from "@/components/ui/section";
import { getPrimaryServiceCopy } from "@/data/positioning";
import { getPublicServices } from "@/lib/public-content";
import { pageMetadata } from "@/lib/seo";
import type { Service } from "@/types";

export const revalidate = 3600;

export const metadata: Metadata = pageMetadata({
  title: "Website & Web Application Development",
  absoluteTitle: "Website & Web Application Development",
  description:
    "Hire me to build a business website or a custom web application — scoped around what you need to ship, with custom pricing.",
  path: "/services",
});

function formatDuration(service: Service): string | null {
  const { estimatedDaysMin, estimatedDaysMax } = service;
  if (estimatedDaysMin != null && estimatedDaysMax != null) {
    return `${estimatedDaysMin}–${estimatedDaysMax} days`;
  }
  if (estimatedDaysMin != null) {
    return `From ${estimatedDaysMin} day${estimatedDaysMin === 1 ? "" : "s"}`;
  }
  if (estimatedDaysMax != null) {
    return `Up to ${estimatedDaysMax} day${estimatedDaysMax === 1 ? "" : "s"}`;
  }
  return null;
}

function ServiceList({
  title,
  items,
}: {
  title: string;
  items: readonly string[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
        {title}
      </h3>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="text-sm leading-6">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ServiceCard({ service }: { service: Service }) {
  const duration = formatDuration(service);
  const copy = getPrimaryServiceCopy(service);
  const features =
    service.features.length > 0 ? service.features : copy.features;

  return (
    <Card className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        {service.image ? (
          <div className="relative mb-6 aspect-[16/9] overflow-hidden rounded-2xl bg-accent-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={service.image}
              alt={`${service.title} overview`}
              className="h-full w-full object-cover"
            />
          </div>
        ) : null}
        <h2 className="font-display text-2xl tracking-tight">{service.title}</h2>
        {service.description || service.shortDescription ? (
          <p className="mt-4 text-sm leading-7 text-muted sm:text-base">
            {service.description || service.shortDescription}
          </p>
        ) : null}
        <div className="mt-8 grid gap-6">
          <ServiceList title="What is included" items={copy.included} />
          <ServiceList title="Typical deliverables" items={copy.deliverables} />
          <ServiceList title="What you receive" items={copy.youReceive} />
        </div>
        <div className="mt-8">
          <ButtonLink href={`/start-project?service=${service.slug}`}>
            Start this project
          </ButtonLink>
        </div>
      </div>
      <div className="grid gap-6">
        <ServiceList title="Key features" items={features} />
        <div>
          <h3 className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
            Pricing &amp; timeline
          </h3>
          <dl className="mt-3 space-y-3 text-sm leading-6">
            <div>
              <dt className="text-muted">Pricing</dt>
              <dd className="mt-1 font-medium">Custom Pricing</dd>
            </div>
            {duration ? (
              <div>
                <dt className="text-muted">Estimated timeline</dt>
                <dd className="mt-1">{duration}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-muted">Revisions &amp; support</dt>
              <dd className="mt-1">
                Review rounds and post-launch support are agreed in the project
                scope — not a fixed package.
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </Card>
  );
}

async function ServicesContent() {
  const result = await getPublicServices();

  if (result.status === "ok") {
    return (
      <div className="grid gap-6">
        {result.data.map((service) => (
          <ServiceCard key={service.id} service={service} />
        ))}
      </div>
    );
  }

  if (result.status === "empty") {
    return (
      <ContentStateMessage>
        Services are not published yet. Check back soon to see what is available.
      </ContentStateMessage>
    );
  }

  return (
    <ContentStateMessage>
      The services list is temporarily unavailable. Please try again shortly.
    </ContentStateMessage>
  );
}

export default function ServicesPage() {
  return (
    <>
      <PageHero
        eyebrow="Services"
        title="What you can hire me to build"
        description="Two services: a website that presents your work clearly, or a custom web application for a product, dashboard, or internal workflow. Pricing is custom, based on scope."
      />

      <Section className="pt-12 sm:pt-16">
        <Suspense fallback={<ServiceListSkeleton />}>
          <ServicesContent />
        </Suspense>
      </Section>

      <FaqSection description="How hiring, payment, revisions, and handover typically work. Details that depend on the project are written into the scope." />

      <CallToAction
        title="Not sure which service fits?"
        description="Tell me what you need — a website, a web application, or a redesign — and I will suggest a practical next step."
      />
    </>
  );
}
