import { Button, ButtonLink } from "@/components/ui/button";

export function ProjectRequestSuccess({ onReset }: { onReset: () => void }) {
  return (
    <div className="rounded-3xl border border-card-border bg-card px-6 py-14 text-center sm:px-12">
      <p className="text-xs font-medium tracking-[0.22em] text-accent uppercase">
        Request received
      </p>
      <h2 className="font-display mt-3 text-3xl tracking-tight">
        Thanks! Your project request has been received.
      </h2>
      <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-muted sm:text-base">
        I will review the brief and follow up with next steps. Nothing has been
        billed, and you can send another request if the details change.
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <ButtonLink href="/">Back home</ButtonLink>
        <Button variant="secondary" onClick={onReset}>
          Submit another request
        </Button>
      </div>
    </div>
  );
}
