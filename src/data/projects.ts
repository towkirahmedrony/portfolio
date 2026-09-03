import type { Project } from "@/types";

export const projects: Project[] = [
  {
    id: "lumina-studio",
    title: "Lumina Studio",
    description:
      "A refined studio website for a photography practice, built around large imagery, calm typography, and a booking-focused contact flow.",
    category: "Business",
    image: "/projects/lumina-studio.svg",
    technologies: ["Next.js", "TypeScript", "Tailwind CSS"],
    liveUrl: "https://example.com",
    githubUrl: "https://github.com",
    featured: true,
  },
  {
    id: "northwind-commerce",
    title: "Northwind Commerce",
    description:
      "A contemporary apparel storefront with collection browsing, product detail pages, and a streamlined cart experience.",
    category: "E-commerce",
    image: "/projects/northwind-commerce.svg",
    technologies: ["Next.js", "Stripe", "Tailwind CSS"],
    liveUrl: "https://example.com",
    githubUrl: "https://github.com",
    featured: true,
  },
  {
    id: "peak-fitness",
    title: "Peak Fitness",
    description:
      "A high-energy landing page for a training program launch, designed to convert paid traffic into trial sign-ups.",
    category: "Landing",
    image: "/projects/peak-fitness.svg",
    technologies: ["Next.js", "React", "Tailwind CSS"],
    liveUrl: "https://example.com",
    featured: true,
  },
  {
    id: "atlas-legal",
    title: "Atlas Legal",
    description:
      "A trust-first website for a boutique law firm, with practice-area pages, attorney profiles, and a discreet consultation request path.",
    category: "Business",
    image: "/projects/atlas-legal.svg",
    technologies: ["Next.js", "TypeScript", "MDX"],
    liveUrl: "https://example.com",
    featured: true,
  },
  {
    id: "foliocraft",
    title: "FolioCraft",
    description:
      "An editorial portfolio for an independent designer, featuring case studies, process notes, and a restrained visual system.",
    category: "Portfolio",
    image: "/projects/foliocraft.svg",
    technologies: ["Next.js", "Tailwind CSS", "Framer Motion"],
    liveUrl: "https://example.com",
    githubUrl: "https://github.com",
    featured: true,
  },
  {
    id: "pulse-ops",
    title: "Pulse Ops",
    description:
      "An operations dashboard for a logistics team to track shipments, exceptions, and daily throughput in one place.",
    category: "Application",
    image: "/projects/pulse-ops.svg",
    technologies: ["Next.js", "TypeScript", "PostgreSQL"],
    liveUrl: "https://example.com",
    githubUrl: "https://github.com",
    featured: true,
  },
];

export const projectCategories = [
  "All",
  ...Array.from(new Set(projects.map((project) => project.category))),
] as const;
