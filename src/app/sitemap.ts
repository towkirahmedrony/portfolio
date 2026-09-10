import type { MetadataRoute } from "next";
import { site } from "@/data/site";
import { getPublishedProjectSlugs } from "@/lib/public-content";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes = [
    "",
    "/services",
    "/projects",
    "/about",
    "/contact",
    "/start-project",
    "/ai-assistant",
  ];
  const slugs = await getPublishedProjectSlugs();

  const staticEntries: MetadataRoute.Sitemap = routes.map((route) => ({
    url: `${site.url}${route}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: route === "" ? 1 : 0.8,
  }));

  const projectEntries: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: `${site.url}/projects/${slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticEntries, ...projectEntries];
}
