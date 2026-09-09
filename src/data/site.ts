import type { NavItem, SocialLink } from "@/types";

export const site = {
  name: "Shakib Shahriar",
  role: "Freelance Web Developer",
  headline:
    "I design and build websites and web applications that are clear, fast, and easy to use.",
  tagline:
    "Need a new website, a custom web app, or a clearer version of what you already have? I plan the structure, write the interface, and ship work that is ready to grow.",
  description:
    "Freelance web developer for website development and web application development — from business sites to custom web apps.",
  email: "shakib.shahriarr@gmail.com",
  whatsapp: "+8801353297648",
  whatsappDisplay: "+880 1353-297648",
  location: "Available worldwide",
  url: "https://shakib-shahriar.vercel.app",
} as const;

export const navigation: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/projects", label: "Projects" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/profile", label: "Profile" },
];

export const socialLinks: SocialLink[] = [
  { label: "GitHub", href: "https://github.com/myself-shakib" },
];
