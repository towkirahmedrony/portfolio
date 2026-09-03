import { ButtonLink } from "@/components/ui/button";
import { Section } from "@/components/ui/section";

export function CallToAction({
  title = "Have a project in mind?",
  description = "Tell me about the website you need. I will reply with a clear next step, timeline, and a practical way to get started.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <Section className="pt-0">
      <div className="rounded-3xl border border-card-border bg-accent-soft px-6 py-12 text-center sm:px-12 sm:py-16">
        <p className="mb-3 text-xs font-medium tracking-[0.22em] text-accent uppercase">
          Next step
        </p>
        <h2 className="font-display mx-auto max-w-2xl text-3xl tracking-tight text-balance sm:text-4xl">
          {title}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted">
          {description}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <ButtonLink href="/contact" size="lg">
            Start a Project
          </ButtonLink>
          <ButtonLink href="/projects" variant="secondary" size="lg">
            View My Work
          </ButtonLink>
        </div>
      </div>
    </Section>
  );
}
