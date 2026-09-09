import type { Service } from "@/types";

export const PRIMARY_SERVICE_COPY = {
  website: {
    slug: "website-development",
    title: "Website Development",
    description:
      "Fast, responsive, modern websites designed around your brand, goals, and users.",
  },
  webApp: {
    slug: "web-application-development",
    title: "Web Application Development",
    description:
      "Custom web applications built for real workflows, products, dashboards, platforms, and business needs.",
  },
} as const;

export const FALLBACK_PUBLIC_SERVICES: Service[] = [
  {
    id: "fallback-website-development",
    slug: PRIMARY_SERVICE_COPY.website.slug,
    title: PRIMARY_SERVICE_COPY.website.title,
    shortDescription: PRIMARY_SERVICE_COPY.website.description,
    description: PRIMARY_SERVICE_COPY.website.description,
    startingPrice: null,
    currency: "BDT",
    estimatedDaysMin: null,
    estimatedDaysMax: null,
    features: [
      "Responsive layout across phone, tablet, and desktop",
      "Modern frontend implementation",
      "Clear structure for brand, offer, and calls to action",
    ],
    featured: true,
    image: null,
  },
  {
    id: "fallback-web-application-development",
    slug: PRIMARY_SERVICE_COPY.webApp.slug,
    title: PRIMARY_SERVICE_COPY.webApp.title,
    shortDescription: PRIMARY_SERVICE_COPY.webApp.description,
    description: PRIMARY_SERVICE_COPY.webApp.description,
    startingPrice: null,
    currency: "BDT",
    estimatedDaysMin: null,
    estimatedDaysMax: null,
    features: [
      "Custom workflows, dashboards, and product interfaces",
      "Authentication and data-backed features where needed",
      "Built to scale with the product, not a generic template",
    ],
    featured: true,
    image: null,
  },
];

const PROJECT_DESCRIPTION_OVERRIDES: { match: RegExp; description: string }[] = [
  {
    match: /blueprint\.?\s*bd/i,
    description:
      "A bilingual English and Bengali editorial platform for publishing and discovering business, technology, and policy content, with sectioned articles, a newsletter, and a latest-news feed.",
  },
  {
    match: /startups\.?\s*bd/i,
    description:
      "A searchable web application for browsing publicly disclosed startup funding rounds in Bangladesh, with a deal archive plus company and sector directories.",
  },
  {
    match: /sport\s*app/i,
    description:
      "A web application for browsing football leagues and teams, with search, dedicated league and team pages, and data from TheSportsDB API.",
  },
  {
    match: /brikko/i,
    description:
      "A web application that generates landing pages from a short business description, including copy, layout, a contact form, multilingual support, and publishing to a subdomain or custom domain.",
  },
  {
    match: /top\s*50\s*websites/i,
    description:
      "An editorial website directory of tools and platforms across categories such as AI, developer, design, and productivity, with written profiles, search and filters, and PWA support.",
  },
];

function normalizeServiceKey(slug: string, name: string): string {
  return `${slug} ${name}`.toLowerCase();
}

export function isPrimaryPublicService(slug: string, name: string): boolean {
  const key = normalizeServiceKey(slug, name);

  if (
    key.includes("android") ||
    /\bseo\b/.test(key) ||
    key.includes("search optimization") ||
    key.includes("maintenance") ||
    key.includes("logo")
  ) {
    return false;
  }

  if (
    key.includes("website development") ||
    slug.toLowerCase().includes("website-development")
  ) {
    return true;
  }

  if (
    key.includes("web application") ||
    slug.toLowerCase().includes("web-application") ||
    slug.toLowerCase().includes("web-app-development")
  ) {
    return true;
  }

  return false;
}

function primaryServiceRank(slug: string, name: string): number {
  const key = normalizeServiceKey(slug, name);
  if (
    key.includes("website development") ||
    slug.toLowerCase().includes("website-development")
  ) {
    return 0;
  }
  return 1;
}

export function toPositionedService(service: Service): Service {
  const key = normalizeServiceKey(service.slug, service.title);
  const isWebsite =
    key.includes("website development") ||
    service.slug.toLowerCase().includes("website-development");
  const copy = isWebsite
    ? PRIMARY_SERVICE_COPY.website
    : PRIMARY_SERVICE_COPY.webApp;

  return {
    ...service,
    title: copy.title,
    shortDescription: copy.description,
    description: copy.description,
    features: service.features.filter(
      (feature) => !isDiscontinuedServiceLabel(feature),
    ),
  };
}

export function filterPrimaryServices(services: Service[]): Service[] {
  const filtered = services
    .filter((service) => isPrimaryPublicService(service.slug, service.title))
    .sort(
      (a, b) =>
        primaryServiceRank(a.slug, a.title) - primaryServiceRank(b.slug, b.title),
    )
    .map(toPositionedService);

  return filtered.length > 0 ? filtered : FALLBACK_PUBLIC_SERVICES;
}

export function isDiscontinuedServiceLabel(value: string): boolean {
  const key = value.toLowerCase();
  return (
    key.includes("android") ||
    /\bseo\b/.test(key) ||
    key.includes("search optimization") ||
    key.includes("maintenance") ||
    key.includes("logo design") ||
    key.includes("logo designing")
  );
}

function stripUnverifiedClaims(text: string): string {
  return text
    .replace(/[^.]*\b200,?000\b[^.]*\.?/gi, "")
    .replace(/[^.]*\b50,?000\b[^.]*\.?/gi, "")
    .replace(/[^.]*\b500\+\b[^.]*\.?/gi, "")
    .replace(/[^.]*monthly readers[^.]*\.?/gi, "")
    .replace(/[^.]*newsletter subscribers[^.]*\.?/gi, "")
    .replace(/[^.]*\b\d[\d,]*\+?\s+(users|downloads|clients|projects|pages)\b[^.]*\.?/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\./g, ".")
    .trim();
}

export function toFactualProjectDescription(
  title: string,
  slug: string,
  description: string,
): string {
  const haystack = `${title} ${slug}`;
  const override = PROJECT_DESCRIPTION_OVERRIDES.find((item) =>
    item.match.test(haystack),
  );

  if (override) {
    return override.description;
  }

  return toShortDescription(stripUnverifiedClaims(description));
}

function toShortDescription(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return cleaned;
  }

  const parts = cleaned.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g);
  if (!parts) {
    return cleaned;
  }

  return parts.slice(0, 2).join(" ").replace(/\s+/g, " ").trim();
}
