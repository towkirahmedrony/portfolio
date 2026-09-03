import type { Reason, SkillGroup } from "@/types";

export const skillGroups: SkillGroup[] = [
  {
    category: "Frontend",
    skills: [
      "React",
      "Next.js",
      "TypeScript",
      "Tailwind CSS",
      "HTML & CSS",
      "Accessibility",
    ],
  },
  {
    category: "Backend",
    skills: ["Node.js", "REST APIs", "Server Actions", "Authentication", "Webhooks"],
  },
  {
    category: "Database",
    skills: ["PostgreSQL", "Prisma", "Supabase", "Redis"],
  },
  {
    category: "Tools",
    skills: ["Git", "Vercel", "Figma", "ESLint", "Playwright"],
  },
];

export const reasons: Reason[] = [
  {
    title: "Responsive design",
    description:
      "Every layout is built mobile-first so it reads well on a phone, tablet, and desktop without awkward breakpoints.",
  },
  {
    title: "Modern technologies",
    description:
      "I work with Next.js, TypeScript, and Tailwind CSS — a stack that is fast to ship, easy to maintain, and ready to grow.",
  },
  {
    title: "Performance",
    description:
      "Images, fonts, and markup are optimized so pages load quickly and stay snappy as content expands.",
  },
  {
    title: "Clean code",
    description:
      "Reusable components, strict TypeScript, and a clear folder structure make future features cheaper to add.",
  },
  {
    title: "Client-focused development",
    description:
      "I start from your offer, audience, and goals — then translate them into pages that are easy to understand and act on.",
  },
];
