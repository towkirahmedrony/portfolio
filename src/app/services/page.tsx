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

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Freelance web development services including business websites, portfolios, e-commerce, landing pages, and custom web applications.",
  openGraph: {
    title: "Services",
    description:
      "Freelance web development services including business websites, portfolios, e-commerce, landing pages, and custom web applications.",
  },
};

function formatPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    const digits = new Intl.NumberFormat("en").format(amount);
    return `${currency} ${digits}`.trim();
  }
}

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
  const showPricing = service.startingPrice != null || duration != null;

  return (
    <Card className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        <h2 className="font-display text-2xl tracking-tight">{service.title}</h2>
        {service.description || service.shortDescription ? (
          <p className="mt-4 text-sm leading-7 text-muted sm:text-base">
            {service.description || service.shortDescription}
          </p>
        ) : null}
        <div className="mt-6">
          <ButtonLink href="/start-project">Start this project</ButtonLink>
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
        {showPricing ? (
          <div>
            <h3 className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
              Pricing &amp; timeline
            </h3>
            <dl className="mt-3 space-y-2 text-sm leading-6">
              {service.startingPrice != null ? (
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted">Starting price</dt>
                  <dd className="font-medium">
                    {formatPrice(service.startingPrice, service.currency)}
                  </dd>
                </div>
              ) : null}
              {duration ? (
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted">Timeline</dt>
                  <dd>{duration}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : null}
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
        title="What I can build for you"
        description="Each service is a complete engagement: discovery, design, development, and launch — tailored to the kind of site your business actually needs."
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
