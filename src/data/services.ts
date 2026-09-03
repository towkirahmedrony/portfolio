import type { Service } from "@/types";

export const services: Service[] = [
  {
    id: "business",
    title: "Business Websites",
    shortDescription:
      "Polished company sites that explain your offer, build trust, and convert visitors into clients.",
    description:
      "A professional business website is often the first impression you make. I build clear, credible sites that present your services, proof, and next steps without clutter — so visitors understand why they should work with you.",
    features: [
      "Custom homepage and service pages",
      "About, testimonials, and contact flows",
      "SEO-ready structure and metadata",
      "Mobile-first responsive layouts",
      "Performance-focused implementation",
    ],
    technologies: ["Next.js", "TypeScript", "Tailwind CSS", "Vercel"],
  },
  {
    id: "portfolio",
    title: "Portfolio Websites",
    shortDescription:
      "Editorial portfolios that present your work with clarity, rhythm, and a distinctive visual identity.",
    description:
      "I create portfolio sites that let the work lead. Layout, typography, and interaction are tuned so your projects feel considered and easy to browse — whether you are a designer, photographer, studio, or consultant.",
    features: [
      "Case-study oriented project pages",
      "Filterable project galleries",
      "Refined typography and imagery",
      "Light and dark presentation options",
      "Easy-to-update content structure",
    ],
    technologies: ["Next.js", "React", "Tailwind CSS", "Framer Motion"],
  },
  {
    id: "ecommerce",
    title: "E-commerce Websites",
    shortDescription:
      "Storefronts designed for browsing, trust, and checkout — not just product grids.",
    description:
      "I build e-commerce experiences that keep product discovery simple and checkout friction low. From catalogue pages to cart flows, the focus is conversion, clarity, and maintainable code your team can grow with.",
    features: [
      "Product catalogue and detail pages",
      "Cart and checkout-ready architecture",
      "Mobile shopping experience",
      "Search, filters, and collections",
      "Analytics and conversion tracking hooks",
    ],
    technologies: ["Next.js", "Stripe", "Shopify", "TypeScript"],
  },
  {
    id: "landing",
    title: "Landing Pages",
    shortDescription:
      "Focused campaign pages built to communicate one offer and drive one action.",
    description:
      "Landing pages work when the message is sharp and the path is obvious. I design and develop pages that pair strong hierarchy with fast load times — ideal for product launches, ads, and lead generation.",
    features: [
      "Single-offer narrative structure",
      "High-contrast calls to action",
      "A/B-friendly section layout",
      "Lead capture and scheduling links",
      "Fast Core Web Vitals performance",
    ],
    technologies: ["Next.js", "Tailwind CSS", "React", "Analytics"],
  },
  {
    id: "custom",
    title: "Custom Web Applications",
    shortDescription:
      "Tailored web apps for workflows that off-the-shelf tools cannot cover well.",
    description:
      "When your product or internal process needs more than a brochure site, I build custom web applications with clean architecture, typed interfaces, and room to expand — dashboards, client portals, and operational tools.",
    features: [
      "Product discovery and technical planning",
      "Component-driven UI systems",
      "Typed APIs and data models",
      "Authentication-ready architecture",
      "Scalable Next.js App Router structure",
    ],
    technologies: ["Next.js", "TypeScript", "Node.js", "PostgreSQL"],
  },
];
