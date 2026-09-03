import type { Metadata } from "next";
import { CallToAction } from "@/components/cta";
import { Card } from "@/components/ui/card";
import { PageHero, Section } from "@/components/ui/section";
import { Badge } from "@/components/ui/badge";
import { site } from "@/data/site";
import { skillGroups } from "@/data/skills";

export const metadata: Metadata = {
  title: "About",
  description: `About ${site.name}, a freelance web developer focused on modern, conversion-oriented websites built with Next.js and TypeScript.`,
  openGraph: {
    title: "About",
    description: `About ${site.name}, a freelance web developer focused on modern, conversion-oriented websites built with Next.js and TypeScript.`,
  },
};

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title="A freelance developer who cares about the details clients notice."
        description={`${site.name} is an independent web developer helping businesses launch websites that feel current, load quickly, and make the next step obvious.`}
      />

      <Section
        eyebrow="Introduction"
        title="Built around clarity, not decoration"
        description="I work with founders, studios, and small teams who need a website that looks professional and is easy to maintain. The work is hands-on: I design the information architecture, write the interface, and ship the code."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Card>
            <h3 className="font-display text-xl tracking-tight">
              Development philosophy
            </h3>
            <p className="mt-3 text-sm leading-7 text-muted">
              Good websites are quiet. Hierarchy, type, and spacing should do
              most of the work. I prefer a limited visual language, accessible
              markup, and components that can grow into a larger product without
              being rewritten.
            </p>
          </Card>
          <Card>
            <h3 className="font-display text-xl tracking-tight">How I work</h3>
            <p className="mt-3 text-sm leading-7 text-muted">
              Direct communication, written scope, and regular previews. You
              always know what is being built and why. I would rather ship a
              focused first version well than overpromise a platform you do not
              need yet.
            </p>
          </Card>
        </div>
      </Section>

      <Section
        eyebrow="Capabilities"
        title="Skills and technologies"
        description="A practical stack for marketing sites and custom applications — chosen because it is fast, typed, and widely supported."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          {skillGroups.map((group) => (
            <Card key={group.category}>
              <h2 className="font-display text-xl tracking-tight">
                {group.category}
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {group.skills.map((skill) => (
                  <Badge key={skill}>{skill}</Badge>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <CallToAction title="If this sounds like a fit, let’s talk." />
    </>
  );
}
