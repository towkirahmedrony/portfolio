import { ButtonLink } from "@/components/ui/button";

export default function ProjectRequestNotFound() {
  return (
    <section className="flex flex-1 flex-col items-center justify-center px-5 py-32 text-center">
      <p className="text-xs font-medium tracking-[0.22em] text-accent uppercase">
        Not found
      </p>
      <h1 className="font-display mt-4 text-3xl tracking-tight">
        Project request not found
      </h1>
      <p className="mt-4 max-w-md text-muted">
        This request does not exist or you do not have access to it.
      </p>
      <div className="mt-8">
        <ButtonLink href="/profile">Back to profile</ButtonLink>
      </div>
    </section>
  );
}
