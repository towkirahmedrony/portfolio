import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="flex flex-1 flex-col items-center justify-center px-5 py-32 text-center">
      <p className="text-xs font-medium tracking-[0.22em] text-accent uppercase">
        404
      </p>
      <h1 className="font-display mt-4 text-4xl tracking-tight">
        Page not found
      </h1>
      <p className="mt-4 max-w-md text-muted">
        That page does not exist. Head back home or browse the work instead.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/">Back home</ButtonLink>
        <ButtonLink href="/projects" variant="secondary">
          View projects
        </ButtonLink>
      </div>
    </section>
  );
}
