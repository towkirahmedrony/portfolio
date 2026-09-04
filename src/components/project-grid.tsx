"use client";

import { useMemo, useState } from "react";
import { ProjectCard } from "@/components/project-card";
import { cn } from "@/lib/utils";
import type { Project } from "@/types";

type Filter = "All" | string;

export function ProjectGrid({ projects }: { projects: Project[] }) {
  const [filter, setFilter] = useState<Filter>("All");

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          projects
            .map((project) => project.category)
            .filter((category): category is string => Boolean(category)),
        ),
      ),
    [projects],
  );

  const filters: Filter[] = ["All", ...categories];

  const visible = useMemo(() => {
    if (filter === "All") {
      return projects;
    }
    return projects.filter((project) => project.category === filter);
  }, [filter, projects]);

  return (
    <div>
      <div
        className="mb-8 flex flex-wrap gap-2"
        role="tablist"
        aria-label="Filter projects by category"
      >
        {filters.map((category) => {
          const active = filter === category;
          return (
            <button
              key={category}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(category)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm transition-colors",
                active
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-card-border bg-card text-muted hover:text-foreground",
              )}
            >
              {category}
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
}
