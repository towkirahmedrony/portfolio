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

export const aboutStats = [
  { value: "100+", label: "Projects Delivered" },
  { value: "2+", label: "Years Experience" },
] as const;

export const aboutTechnologies = [
  "Next.js",
  "React",
  "TypeScript",
  "JavaScript",
  "Tailwind CSS",
  "Supabase",
  "PostgreSQL",
  "Kotlin",
  "Jetpack Compose",
] as const;

export const reasons: Reason[] = [
  {
    title: "Built around your offer",
    description:
      "I start from what you sell, who it is for, and what a visitor should do next — then turn that into clear pages.",
  },
  {
    title: "Websites that work on every screen",
    description:
      "Layouts are designed mobile-first so the site stays readable on a phone, tablet, and desktop.",
  },
  {
    title: "Fast to load, easy to maintain",
    description:
      "Pages are built to stay snappy as content grows, without a fragile pile of one-off code.",
  },
  {
    title: "A focused first version",
    description:
      "I would rather ship something you can use than overbuild a platform you do not need yet.",
  },
  {
    title: "You work with me directly",
    description:
      "No account hand-offs. Scope, design, and development stay with the same person.",
  },
];
