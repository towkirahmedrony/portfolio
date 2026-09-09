import type { Metadata } from "next";
import { CallToAction } from "@/components/cta";
import { Card } from "@/components/ui/card";
import { PageHero, Section } from "@/components/ui/section";
import { Badge } from "@/components/ui/badge";
import { site, socialLinks } from "@/data/site";
import { skillGroups } from "@/data/skills";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: `About ${site.name} — Freelance Web Developer`,
  absoluteTitle: `About ${site.name} — Freelance Web Developer`,
  description: `${site.name} is a freelance web developer. Work is hands-on: structure, interface, and shipping the code for websites and web applications.`,
  path: "/about",
});

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title={`${site.name} is a freelance web developer.`}
        description="I work directly with founders, studios, and small teams who need a website or web application that looks professional and is straightforward to maintain."
      />

      <Section
        eyebrow="Introduction"
        title="Who I am and what I build"
        description="The practice is small on purpose. You talk to the same person who plans the pages, writes the interface, and ships the code."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Card>
            <h3 className="font-display text-xl tracking-tight">
              What I specialize in
            </h3>
            <p className="mt-3 text-sm leading-7 text-muted">
              Website development and web application development. That might
              mean a new business site, a custom product or dashboard, or a
              clearer version of a site you already have.
            </p>
          </Card>
          <Card>
            <h3 className="font-display text-xl tracking-tight">
              How I think about the work
            </h3>
            <p className="mt-3 text-sm leading-7 text-muted">
              Good websites are quiet. Hierarchy, type, and spacing should do
              most of the work. I prefer a limited visual language, accessible
              markup, and components that can grow without being rewritten.
            </p>
          </Card>
          <Card>
            <h3 className="font-display text-xl tracking-tight">How we work</h3>
            <p className="mt-3 text-sm leading-7 text-muted">
              Direct communication, written scope, and regular previews. You
              always know what is being built and why. I would rather ship a
              focused first version well than overpromise a platform you do not
              need yet.
            </p>
          </Card>
          <Card>
            <h3 className="font-display text-xl tracking-tight">
              What you can expect
            </h3>
            <p className="mt-3 text-sm leading-7 text-muted">
              You work with me directly. I listen first, keep the brief
              practical, and send work you can review before anything goes live.
            </p>
          </Card>
        </div>
        {socialLinks.length > 0 ? (
          <p className="mt-8 text-sm leading-7 text-muted">
            Public work lives on{" "}
            {socialLinks.map((item, index) => (
              <span key={item.href}>
                {index > 0 ? ", " : null}
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {item.label}
                </a>
              </span>
            ))}
            .
          </p>
        ) : null}
      </Section>

      <Section
        eyebrow="Stack"
        title="Tools I use when they help the product"
        description="Useful if you want to know how a site or app is built. The work still starts from your offer, audience, and workflow — not from a technology list."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          {skillGroups.map((group) => (
            <Card key={group.category}>
              <h3 className="font-display text-xl tracking-tight">
                {group.category}
              </h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {group.skills.map((skill) => (
                  <Badge key={skill}>{skill}</Badge>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <CallToAction
        title="If this sounds like a fit, let's talk."
        description="Tell me about the website or web app you need. I will reply with a clear next step."
      />
    </>
  );
}
