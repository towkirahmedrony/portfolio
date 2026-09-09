import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CallToAction } from "@/components/cta";
import { ContentStateMessage } from "@/components/public/content-states";
import { ButtonLink } from "@/components/ui/button";
import { PageHero, Section } from "@/components/ui/section";
import { site } from "@/data/site";
import {
  getPublicProjectBySlug,
  getPublishedProjectSlugs,
} from "@/lib/public-content";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const slugs = await getPublishedProjectSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPublicProjectBySlug(slug);

  if (result.status !== "ok") {
    return pageMetadata({
      title: "Project",
      description: `Selected work by ${site.name}, freelance web developer.`,
      path: `/projects/${slug}`,
    });
  }

  const project = result.data;
  const description =
    project.description ||
    `${project.title} — a website or web application by ${site.name}.`;

  return pageMetadata({
    title: project.title,
    description,
    path: `/projects/${project.slug}`,
    image: project.image,
    imageAlt: `${project.title} preview`,
  });
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getPublicProjectBySlug(slug);

  if (result.status === "empty") {
    notFound();
  }

  if (result.status !== "ok") {
    return (
      <Section className="pt-28 sm:pt-32">
        <ContentStateMessage>
          This project is temporarily unavailable. Please try again shortly.
        </ContentStateMessage>
      </Section>
    );
  }

  const project = result.data;

  return (
    <>
      <PageHero
        eyebrow={project.category || "Project"}
        title={project.title}
        description={
          project.description ||
          "A website or web application built for a real product or workflow."
        }
      />

      <Section className="pt-12 sm:pt-16">
        {project.image ? (
          <div className="relative mb-10 overflow-hidden rounded-3xl border border-card-border bg-accent-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={project.image}
              alt={`${project.title} preview`}
              className="h-auto w-full object-cover"
            />
          </div>
        ) : null}

        <div className="grid min-w-0 gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
          <div className="min-w-0">
            {project.technologies.length > 0 ? (
              <>
                <h2 className="font-display text-2xl tracking-tight">
                  Built with
                </h2>
                <p className="mt-4 break-words text-sm leading-7 text-muted sm:text-base">
                  {project.technologies.join(" · ")}
                </p>
              </>
            ) : (
              <p className="text-sm leading-7 text-muted sm:text-base">
                Links and a live demo are listed when they are available.
              </p>
            )}
          </div>

          <aside className="rounded-2xl border border-card-border bg-card p-6 sm:p-8">
            <h2 className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
              Links
            </h2>
            <div className="mt-4 flex flex-col gap-3">
              {project.liveUrl ? (
                <ButtonLink
                  href={project.liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View live site
                </ButtonLink>
              ) : null}
              {project.githubUrl ? (
                <ButtonLink
                  href={project.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="secondary"
                >
                  Source code
                </ButtonLink>
              ) : null}
              <ButtonLink href="/projects" variant="ghost">
                All projects
              </ButtonLink>
            </div>
          </aside>
        </div>
      </Section>

      <CallToAction
        title="Have a project in mind?"
        description="Let's discuss what you want to build — a website, a web application, or an improvement to what you already have."
      />
    </>
  );
}
