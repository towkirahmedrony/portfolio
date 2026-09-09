import type { Metadata } from "next";
import { site } from "@/data/site";

type PageMetaInput = {
  title: string;
  description: string;
  path: string;
  absoluteTitle?: string;
  image?: string | null;
  imageAlt?: string;
};

export function pageMetadata({
  title,
  description,
  path,
  absoluteTitle,
  image,
  imageAlt,
}: PageMetaInput): Metadata {
  const url = new URL(path, site.url).toString();
  const resolvedTitle = absoluteTitle ?? title;

  return {
    title: absoluteTitle ? { absolute: absoluteTitle } : title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: resolvedTitle,
      description,
      url,
      siteName: site.name,
      locale: "en_US",
      type: "website",
      ...(image
        ? { images: [{ url: image, alt: imageAlt ?? resolvedTitle }] }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: resolvedTitle,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}
