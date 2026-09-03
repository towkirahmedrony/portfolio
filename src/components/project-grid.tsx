"use client";

import { useMemo, useState } from "react";
import { projectCategories, projects } from "@/data/projects";
import { ProjectCard } from "@/components/project-card";
import { cn } from "@/lib/utils";
import type { ProjectCategory } from "@/types";

type Filter = "All" | ProjectCategory;

export function ProjectGrid() {
  const [filter, setFilter] = useState<Filter>("All");

  const visible = useMemo(() => {
    if (filter === "All") {
      return projects;
    }
    return projects.filter((project) => project.category === filter);
  }, [filter]);

  return (
    <div>
      <div
        className="mb-8 flex flex-wrap gap-2"
        role="tablist"
        aria-label="Filter projects by category"
      >
        {projectCategories.map((category) => {
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
