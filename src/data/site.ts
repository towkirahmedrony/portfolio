import type { NavItem, SocialLink } from "@/types";

export const site = {
  name: "Alex Rivera",
  role: "Freelance Web Developer",
  tagline: "I design and build fast, conversion-focused websites for ambitious businesses.",
  description:
    "Alex Rivera is a freelance web developer specializing in modern business websites, portfolios, landing pages, and custom web applications.",
  email: "hello@alexrivera.dev",
  whatsapp: "+15551234567",
  whatsappDisplay: "+1 (555) 123-4567",
  location: "Available worldwide",
  url: "https://alexrivera.dev",
} as const;

export const navigation: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/projects", label: "Projects" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export const socialLinks: SocialLink[] = [
  { label: "GitHub", href: "https://github.com" },
  { label: "LinkedIn", href: "https://linkedin.com" },
  { label: "X", href: "https://x.com" },
  { label: "Dribbble", href: "https://dribbble.com" },
];
