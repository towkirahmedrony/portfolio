import Image from "next/image";
import type { Project } from "@/types";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";

export function ProjectCard({ project }: { project: Project }) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-card-border bg-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(20,20,20,0.07)]">
      <div className="relative aspect-[3/2] overflow-hidden bg-accent-soft">
        {project.image ? (
          <Image
            src={project.image}
            alt={`${project.title} preview`}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          />
        ) : null}
      </div>
      <div className="p-6 sm:p-7">
        {project.category ? (
          <p className="text-xs font-medium tracking-[0.16em] text-accent uppercase">
            {project.category}
          </p>
        ) : null}
        <h3 className="font-display mt-2 text-xl tracking-tight">
          {project.title}
        </h3>
        <p className="mt-3 text-sm leading-6 text-muted">{project.description}</p>
        {project.technologies.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {project.technologies.map((tech) => (
              <Badge key={tech}>{tech}</Badge>
            ))}
          </div>
        ) : null}
        {project.liveUrl || project.githubUrl ? (
          <div className="mt-6 flex flex-wrap gap-3">
            {project.liveUrl ? (
              <ButtonLink
                href={project.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                size="md"
              >
                Live Demo
              </ButtonLink>
            ) : null}
            {project.githubUrl ? (
              <ButtonLink
                href={project.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                variant="secondary"
                size="md"
              >
                GitHub
              </ButtonLink>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
