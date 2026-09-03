import { cn } from "@/lib/utils";
import type { ComponentProps, ReactNode } from "react";

type SectionProps = ComponentProps<"section"> & {
  eyebrow?: string;
  title?: string;
  description?: string;
  headingAs?: "h1" | "h2";
  actions?: ReactNode;
};

export function Section({
  className,
  eyebrow,
  title,
  description,
  headingAs = "h2",
  actions,
  children,
  ...props
}: SectionProps) {
  const Heading = headingAs;

  return (
    <section className={cn("py-16 sm:py-20 lg:py-24", className)} {...props}>
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        {(eyebrow || title || description || actions) && (
          <header className="mb-10 max-w-2xl sm:mb-14">
            {eyebrow ? (
              <p className="mb-3 text-xs font-medium tracking-[0.22em] text-accent uppercase">
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <Heading className="font-display text-3xl leading-tight tracking-tight text-balance sm:text-4xl">
                {title}
              </Heading>
            ) : null}
            {description ? (
              <p className="mt-4 text-base leading-7 text-muted sm:text-lg">
                {description}
              </p>
            ) : null}
            {actions ? <div className="mt-6">{actions}</div> : null}
          </header>
        )}
        {children}
      </div>
    </section>
  );
}

export function PageHero({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="border-b border-card-border pt-28 pb-16 sm:pt-32 sm:pb-20">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <p className="mb-3 text-xs font-medium tracking-[0.22em] text-accent uppercase">
          {eyebrow}
        </p>
        <h1 className="font-display max-w-3xl text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
          {title}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">
          {description}
        </p>
      </div>
    </section>
  );
}
