import Image from "next/image";
import Link from "next/link";
import type { Project } from "@/types";
import { ButtonLink } from "@/components/ui/button";

export function ProjectCard({ project }: { project: Project }) {
  const href = `/projects/${project.slug}`;
  const previewLabel = `${project.title} preview`;

  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-card-border bg-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(20,20,20,0.07)]">
      <Link
        href={href}
        className="relative aspect-[3/2] overflow-hidden bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        aria-label={`View ${project.title}`}
      >
        {project.image ? (
          <Image
            src={project.image}
            alt={previewLabel}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          />
        ) : (
          <span className="flex h-full items-center justify-center px-6 text-center text-sm text-muted">
            {project.title}
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-6 sm:p-7">
        {project.category ? (
          <p className="text-xs font-medium tracking-[0.16em] text-accent uppercase">
            {project.category}
          </p>
        ) : null}
        <h3 className="font-display mt-2 text-xl tracking-tight break-words">
          <Link
            href={href}
            className="rounded-sm transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {project.title}
          </Link>
        </h3>
        {project.description ? (
          <p className="mt-3 text-sm leading-6 text-muted">
            {project.description}
          </p>
        ) : null}
        {project.technologies.length > 0 ? (
          <p className="mt-4 text-sm leading-6 text-muted">
            <span className="font-medium text-foreground">Built with:</span>{" "}
            {project.technologies.join(" · ")}
          </p>
        ) : null}
        <div className="mt-auto flex flex-wrap gap-3 pt-6">
          <ButtonLink href={href} size="md">
            View Project
          </ButtonLink>
          {project.liveUrl ? (
            <ButtonLink
              href={project.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="secondary"
              size="md"
            >
              Live site
            </ButtonLink>
          ) : null}
        </div>
      </div>
    </article>
  );
}
