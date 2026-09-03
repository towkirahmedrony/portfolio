import type { NavItem, SocialLink } from "@/types";

export const site = {
  name: "Shakib Shahriar",
  role: "Freelance Web Developer",
  tagline: "I design and build fast, modern websites for businesses and individuals.",
  description:
    "Shakib Shahriar is a freelance web developer specializing in modern business websites, portfolios, landing pages, and custom web applications.",
  email: "shakib.shahriarr@gmail.com",
  whatsapp: "+8801353297648",
  whatsappDisplay: "+880 1353-297648",
  location: "Available worldwide",
  url: "https://techbarta.tech",
} as const;

export const navigation: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/projects", label: "Projects" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export const socialLinks: SocialLink[] = [];
