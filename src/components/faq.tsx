import { faqs } from "@/data/faq";
import { Section } from "@/components/ui/section";

export function FaqSection({
  description = "Practical answers about working together. Anything that depends on the project is agreed in scope.",
}: {
  description?: string;
}) {
  return (
    <Section
      id="faq"
      eyebrow="FAQ"
      title="Questions clients usually ask"
      description={description}
    >
      <div className="rounded-2xl border border-card-border bg-card px-5 sm:px-8">
        {faqs.map((item) => (
          <details
            key={item.question}
            className="group border-b border-card-border last:border-b-0"
          >
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-5 text-left sm:py-6 [&::-webkit-details-marker]:hidden">
              <h3 className="font-display text-base tracking-tight sm:text-lg">
                {item.question}
              </h3>
              <span
                aria-hidden="true"
                className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-card-border text-sm leading-none text-muted transition-transform duration-200 group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="max-w-3xl pb-5 text-sm leading-7 text-muted sm:pb-6">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </Section>
  );
}
