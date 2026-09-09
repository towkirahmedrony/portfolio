import type { NavItem, SocialLink } from "@/types";

export const site = {
  name: "Shakib Shahriar",
  role: "Freelance Web Developer",
  headline:
    "I build fast, modern websites and web apps for businesses and ambitious ideas.",
  tagline:
    "From polished business websites to custom web applications, I design and build fast, responsive, and scalable digital experiences focused on real-world results.",
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
