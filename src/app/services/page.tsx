import type { Metadata } from "next";
import { CallToAction } from "@/components/cta";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHero, Section } from "@/components/ui/section";
import { Badge } from "@/components/ui/badge";
import { services } from "@/data/services";

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

export default function ServicesPage() {
  return (
    <>
      <PageHero
        eyebrow="Services"
        title="What I can build for you"
        description="Each service is a complete engagement: discovery, design, development, and launch — tailored to the kind of site your business actually needs."
      />

      <Section className="pt-12 sm:pt-16">
        <div className="grid gap-6">
          {services.map((service) => (
            <Card key={service.id} className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <h2 className="font-display text-2xl tracking-tight">
                  {service.title}
                </h2>
                <p className="mt-4 text-sm leading-7 text-muted sm:text-base">
                  {service.description}
                </p>
                <div className="mt-6">
                  <ButtonLink href="/start-project">Start this project</ButtonLink>
                </div>
              </div>
              <div className="grid gap-6">
                <div>
                  <h3 className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
                    Key features
                  </h3>
                  <ul className="mt-3 space-y-2">
                    {service.features.map((feature) => (
                      <li key={feature} className="text-sm leading-6">
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
                    Technologies
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {service.technologies.map((tech) => (
                      <Badge key={tech}>{tech}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <CallToAction title="Not sure which service fits?" />
    </>
  );
}
