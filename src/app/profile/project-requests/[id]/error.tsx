"use client";

import { ButtonLink } from "@/components/ui/button";

export default function ProjectRequestDetailsError() {
  return (
    <section className="flex flex-1 flex-col items-center justify-center px-5 py-32 text-center">
      <p className="text-xs font-medium tracking-[0.22em] text-accent uppercase">
        Error
      </p>
      <h1 className="font-display mt-4 text-3xl tracking-tight">
        Could not load this request
      </h1>
      <p className="mt-4 max-w-md text-muted">
        Something went wrong while loading the project request. Please try again.
      </p>
      <div className="mt-8">
        <ButtonLink href="/profile">Back to profile</ButtonLink>
      </div>
    </section>
  );
}
