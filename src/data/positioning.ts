import type { Service } from "@/types";

export const PRIMARY_SERVICE_COPY = {
  website: {
    slug: "website-development",
    title: "Website Development",
    shortDescription:
      "A modern business website that presents your offer clearly on every screen.",
    description:
      "I plan and build a website around what you sell and who it is for. That includes the page structure, layout, and the paths visitors need to understand you and get in touch — without a bloated template.",
    included: [
      "A clear sitemap and page structure before build starts",
      "Responsive layout for phone, tablet, and desktop",
      "Core pages such as home, about, services or work, and contact",
      "Calls to action that match how you already take enquiries",
      "Frontend implementation in a modern, maintainable stack",
    ],
    deliverables: [
      "Production-ready website, deployed or ready to publish",
      "The page structure and content layout we agreed in scope",
      "A short handover covering how the site is organized",
    ],
    features: [
      "Responsive layout across phone, tablet, and desktop",
      "Modern frontend implementation",
      "Clear structure for brand, offer, and calls to action",
      "Contact paths that match how you already work",
    ],
    youReceive: [
      "The finished website and a walkthrough of how pages are put together",
      "Source and hosting setup as agreed in the project scope",
    ],
  },
  webApp: {
    slug: "web-application-development",
    title: "Web Application Development",
    shortDescription:
      "A custom web application built around a real workflow — not a generic template.",
    description:
      "I design and build web apps for products, dashboards, and internal tools. We start from the job the app has to do, then ship a focused first version with the screens, data, and access control that workflow actually needs.",
    included: [
      "Workflow and screen mapping before development",
      "Custom interfaces for the jobs users need to complete",
      "Data-backed features and authentication where the product needs them",
      "A first version scoped to what you will use, not a platform you do not need yet",
    ],
    deliverables: [
      "A working web application covering the agreed workflows",
      "The interfaces, data, and access rules defined in scope",
      "A handover covering how the app is structured and deployed",
    ],
    features: [
      "Custom workflows, dashboards, and product interfaces",
      "Authentication and data-backed features where needed",
      "Built around the product, not a generic template",
      "A focused first version that can grow later",
    ],
    youReceive: [
      "The finished application, ready to use in the environment we agreed",
      "A walkthrough of the main flows and how they are built",
    ],
  },
} as const;

export type PrimaryServiceCopy =
  (typeof PRIMARY_SERVICE_COPY)[keyof typeof PRIMARY_SERVICE_COPY];

export const FALLBACK_PUBLIC_SERVICES: Service[] = [
  {
    id: "fallback-website-development",
    slug: PRIMARY_SERVICE_COPY.website.slug,
    title: PRIMARY_SERVICE_COPY.website.title,
    shortDescription: PRIMARY_SERVICE_COPY.website.shortDescription,
    description: PRIMARY_SERVICE_COPY.website.description,
    startingPrice: null,
    currency: "BDT",
    estimatedDaysMin: null,
    estimatedDaysMax: null,
    features: [...PRIMARY_SERVICE_COPY.website.features],
    featured: true,
    image: null,
  },
  {
    id: "fallback-web-application-development",
    slug: PRIMARY_SERVICE_COPY.webApp.slug,
    title: PRIMARY_SERVICE_COPY.webApp.title,
    shortDescription: PRIMARY_SERVICE_COPY.webApp.shortDescription,
    description: PRIMARY_SERVICE_COPY.webApp.description,
    startingPrice: null,
    currency: "BDT",
    estimatedDaysMin: null,
    estimatedDaysMax: null,
    features: [...PRIMARY_SERVICE_COPY.webApp.features],
    featured: true,
    image: null,
  },
];

const PROJECT_COPY_OVERRIDES: {
  match: RegExp;
  summary: string;
  details: string;
}[] = [
  {
    match: /blueprint\.?\s*bd/i,
    summary:
      "A bilingual English and Bengali editorial site for business, technology, and policy. Readers can browse sectioned articles, a latest-news feed, and a newsletter.",
    details:
      "Blueprint.BD is a news and editorial platform for publishing and discovering business, technology, and policy stories in English and Bengali. The site is built so readers can move through sectioned articles, scan a latest-news feed, and subscribe to a newsletter — instead of a single undifferentiated article list.",
  },
  {
    match: /startups\.?\s*bd/i,
    summary:
      "A searchable database of publicly disclosed startup funding rounds in Bangladesh, with a deal archive plus company and sector directories.",
    details:
      "Startups.bd is a web application for looking up publicly disclosed funding activity in Bangladesh. Search and browse views sit on top of a deal archive, with company and sector directories, so visitors can find rounds without digging through scattered announcements.",
  },
  {
    match: /sport\s*app/i,
    summary:
      "A football browser for leagues and teams, with search, dedicated pages, and listings driven by TheSportsDB API.",
    details:
      "Sport App is a web application for exploring football leagues and teams. It includes search, dedicated league and team pages, and data from TheSportsDB API, so listings stay tied to that source rather than a static table.",
  },
  {
    match: /brikko/i,
    summary:
      "A web app that turns a short business description into a landing page — copy, layout, a contact form, and publishing to a subdomain or custom domain.",
    details:
      "Brikko generates a landing page from a short business description. The flow covers generated copy and layout, a contact form, more than one language, and publishing the result to a subdomain or a custom domain.",
  },
  {
    match: /top\s*50\s*websites/i,
    summary:
      "An editorial directory of tools and platforms, with written profiles, search and filters, and installable PWA support.",
    details:
      "Top 50 Websites is a curated directory of tools and platforms across categories such as AI, developer, design, and productivity. Each listing has a written profile. The site includes search and filters, and can be installed as a PWA.",
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

export function getPrimaryServiceCopy(
  service: Pick<Service, "slug" | "title">,
): PrimaryServiceCopy {
  const key = normalizeServiceKey(service.slug, service.title);
  const isWebsite =
    key.includes("website development") ||
    service.slug.toLowerCase().includes("website-development");

  return isWebsite ? PRIMARY_SERVICE_COPY.website : PRIMARY_SERVICE_COPY.webApp;
}

export function toPositionedService(service: Service): Service {
  const copy = getPrimaryServiceCopy(service);
  const features = service.features.filter(
    (feature) => !isDiscontinuedServiceLabel(feature),
  );

  return {
    ...service,
    title: copy.title,
    shortDescription: copy.shortDescription,
    description: copy.description,
    features: features.length > 0 ? features : [...copy.features],
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

export function toFactualProjectCopy(
  title: string,
  slug: string,
  description: string,
): { summary: string; details: string } {
  const haystack = `${title} ${slug}`;
  const override = PROJECT_COPY_OVERRIDES.find((item) =>
    item.match.test(haystack),
  );

  if (override) {
    return { summary: override.summary, details: override.details };
  }

  const cleaned = stripUnverifiedClaims(description);
  const summary = toShortDescription(cleaned);

  return {
    summary,
    details: cleaned || summary,
  };
}

export function toFactualProjectDescription(
  title: string,
  slug: string,
  description: string,
): string {
  return toFactualProjectCopy(title, slug, description).summary;
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
