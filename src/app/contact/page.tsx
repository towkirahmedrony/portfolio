import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHero, Section } from "@/components/ui/section";
import { site, socialLinks } from "@/data/site";

export const metadata: Metadata = {
  title: "Contact",
  description: `Contact ${site.name} by email, WhatsApp, or social media to start a website project.`,
  openGraph: {
    title: "Contact",
    description: `Contact ${site.name} by email, WhatsApp, or social media to start a website project.`,
  },
};

export default function ContactPage() {
  const whatsappHref = `https://wa.me/${site.whatsapp.replace(/\D/g, "")}`;

  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Get in touch"
        description="Share a short note about what you need. Email and WhatsApp are the fastest ways to reach me — I typically reply within one to two business days."
      />

      <Section className="pt-12 sm:pt-16">
        <div className="grid gap-5 lg:grid-cols-3">
          <Card>
            <h2 className="font-display text-xl tracking-tight">Email</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              Best for briefs, links, and anything you want on record.
            </p>
            <a
              href={`mailto:${site.email}`}
              className="mt-5 inline-block text-sm font-medium text-accent hover:text-accent-hover"
            >
              {site.email}
            </a>
          </Card>

          <Card>
            <h2 className="font-display text-xl tracking-tight">WhatsApp</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              Useful for a quick conversation or to schedule a call.
            </p>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-block text-sm font-medium text-accent hover:text-accent-hover"
            >
              {site.whatsappDisplay}
            </a>
          </Card>

          <Card>
            <h2 className="font-display text-xl tracking-tight">Location</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              Remote-first. Available for clients worldwide, with overlap in
              European and US time zones.
            </p>
            <p className="mt-5 text-sm font-medium">{site.location}</p>
          </Card>
        </div>

        <Card className="mt-5">
          <h2 className="font-display text-xl tracking-tight">Social</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
            Follow along or send a message on the channel you already use.
          </p>
          <ul className="mt-6 flex flex-wrap gap-3">
            {socialLinks.map((item) => (
              <li key={item.label}>
                <ButtonLink
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="secondary"
                >
                  {item.label}
                </ButtonLink>
              </li>
            ))}
          </ul>
        </Card>

        <div className="mt-12 rounded-3xl border border-card-border bg-accent-soft px-6 py-12 text-center sm:px-12">
          <h2 className="font-display text-3xl tracking-tight">
            Ready when you are
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-muted sm:text-base">
            Include your timeline, budget range if you have one, and a sentence
            about the site. That is enough to start.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href="/start-project" size="lg">
              Start a Project
            </ButtonLink>
            <ButtonLink href={`mailto:${site.email}`} variant="secondary" size="lg">
              Email me
            </ButtonLink>
          </div>
        </div>
      </Section>
    </>
  );
}
