import type { ProcessStep } from "@/types";

export const processSteps: ProcessStep[] = [
  {
    step: "01",
    title: "Discussion",
    description:
      "We clarify goals, audience, timeline, and what success looks like. I listen first, then outline a practical path.",
  },
  {
    step: "02",
    title: "Planning",
    description:
      "Sitemap, content needs, and technical scope are defined so there are no surprises once design and build begin.",
  },
  {
    step: "03",
    title: "Design",
    description:
      "Layout, type, and visual hierarchy are composed to feel premium and readable — never decorative for its own sake.",
  },
  {
    step: "04",
    title: "Development",
    description:
      "The site is implemented in Next.js with reusable components, accessible markup, and production-ready performance.",
  },
  {
    step: "05",
    title: "Testing",
    description:
      "I review responsiveness, accessibility, copy, and load speed across devices before anything goes live.",
  },
  {
    step: "06",
    title: "Deployment",
    description:
      "The site ships to a reliable host, analytics are connected, and you receive a clear handover for next steps.",
  },
];
