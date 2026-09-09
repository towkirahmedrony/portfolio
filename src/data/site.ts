import type { NavItem, SocialLink } from "@/types";

export const site = {
  name: "Shakib Shahriar",
  role: "Freelance Web Developer",
  headline:
    "I build websites and web applications for businesses and ambitious ideas.",
  tagline:
    "Need a new website, a custom web app, or a clearer version of what you already have? I design and build fast, responsive experiences that are easy to use and ready to grow.",
  description:
    "Freelance web developer specializing in website development and web application development for businesses and ambitious ideas.",
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
  { href: "/profile", label: "Profile" },
];

export const socialLinks: SocialLink[] = [];
