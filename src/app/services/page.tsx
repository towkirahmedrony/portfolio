import type { Metadata } from "next";
import { Suspense } from "react";
import { CallToAction } from "@/components/cta";
import {
  ContentStateMessage,
  ServiceListSkeleton,
} from "@/components/public/content-states";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHero, Section } from "@/components/ui/section";
import { getPublicServices } from "@/lib/public-content";
import type { Service } from "@/types";

// Public marketing page: published services change rarely. Serve from the
// Next.js cache (ISR) with a one-hour fallback TTL; admin service mutations
// revalidate "/" and "/services" on demand.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Services",
  description:
    "Website development and web application development for businesses and ambitious ideas.",
  openGraph: {
    title: "Services",
    description:
      "Website development and web application development for businesses and ambitious ideas.",
  },
};

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

function ServiceCard({ service }: { service: Service }) {
  const duration = formatDuration(service);

  return (
    <Card className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        {service.image ? (
          <div className="relative mb-6 aspect-[16/9] overflow-hidden rounded-2xl bg-accent-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={service.image}
              alt=""
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
        <div className="mt-6">
          <ButtonLink href={`/start-project?service=${service.slug}`}>
            Start this project
          </ButtonLink>
        </div>
      </div>
      <div className="grid gap-6">
        {service.features.length > 0 ? (
          <div>
            <h3 className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
              Key features
            </h3>
            <ul className="mt-3 space-y-2">
              {service.features.map((feature, index) => (
                <li key={`${service.id}-${index}`} className="text-sm leading-6">
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div>
          <h3 className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
            Pricing &amp; timeline
          </h3>
          <dl className="mt-3 space-y-3 text-sm leading-6">
            <div>
              <dt className="text-muted">Pricing</dt>
              <dd className="mt-1 font-medium">
                Custom pricing based on project scope.
              </dd>
            </div>
            {duration ? (
              <div>
                <dt className="text-muted">Timeline</dt>
                <dd className="mt-1">{duration}</dd>
              </div>
            ) : null}
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
        title="Website and web application development"
        description="I specialize in two services: modern websites for businesses, and custom web applications for products, dashboards, and real workflows."
      />

      <Section className="pt-12 sm:pt-16">
        <Suspense fallback={<ServiceListSkeleton />}>
          <ServicesContent />
        </Suspense>
      </Section>

      <CallToAction title="Not sure which service fits?" />
    </>
  );
}
