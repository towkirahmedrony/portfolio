import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHero, Section } from "@/components/ui/section";
import { site } from "@/data/site";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: `Start a Project — ${site.name}`,
  absoluteTitle: `Start a Project — ${site.name}`,
  description: `Contact ${site.name} about website development, web application development, a redesign, or a custom web project.`,
  path: "/contact",
});

export default function ContactPage() {
  const whatsappHref = `https://wa.me/${site.whatsapp.replace(/\D/g, "")}`;

  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Start a project"
        description="Tell me about your project and I'll get back to you. I work on website development, web application development, existing-site redesigns, and custom web projects."
      />

      <Section className="pt-12 sm:pt-16">
        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="flex flex-col">
            <a
              href={`mailto:${site.email}`}
              className="group -m-6 flex h-full flex-1 flex-col p-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:-m-8 sm:p-8"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
                <EmailIcon />
              </span>
              <h2 className="mt-5 font-display text-xl tracking-tight transition-colors group-hover:text-accent">
                Email Me
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                Best for a short brief about the website or web app you need.
              </p>
              <p className="mt-4 text-sm font-medium break-all">{site.email}</p>
            </a>
          </Card>

          <Card className="flex flex-col">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Chat with me on WhatsApp (opens in a new tab)"
              className="group -m-6 flex h-full flex-1 flex-col p-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:-m-8 sm:p-8"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
                <WhatsAppIcon />
              </span>
              <h2 className="mt-5 font-display text-xl tracking-tight transition-colors group-hover:text-accent">
                WhatsApp
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                A quicker way to ask about a new site, a web app, or a redesign.
              </p>
              <p className="mt-4 text-sm font-medium">{site.whatsappDisplay}</p>
            </a>
          </Card>

          <Card>
            <h2 className="font-display text-xl tracking-tight">Location</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              Remote-first. Available for clients worldwide.
            </p>
            <p className="mt-5 text-sm font-medium">{site.location}</p>
          </Card>
        </div>

        <div className="mt-12 rounded-3xl border border-card-border bg-accent-soft px-6 py-12 text-center sm:px-12">
          <h2 className="font-display text-3xl tracking-tight">
            Ready when you are
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-muted sm:text-base">
            Tell me about the website, web app, or redesign you have in mind.
            A short note is enough to start.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href="/start-project" size="lg">
              Start a Project
            </ButtonLink>
            <ButtonLink href="/projects" variant="secondary" size="lg">
              View My Work
            </ButtonLink>
          </div>
        </div>
      </Section>
    </>
  );
}

function EmailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="3.5"
        y="5.5"
        width="17"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M4.5 8l7.5 5.5L19.5 8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.06 22l5.25-1.38c1.45.79 3.08 1.21 4.73 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.91-7.01zm-7.01 15.24h-.01c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c.02 4.54-3.68 8.23-8.22 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.76-1.85-.2-.48-.4-.42-.56-.42h-.48c-.17 0-.43.06-.66.31-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74 1.76.76 2.18.83 2.97.7.48-.08 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.23-.17-.48-.29z" />
    </svg>
  );
}
