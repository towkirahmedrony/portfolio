export type ServiceId =
  | "business"
  | "portfolio"
  | "ecommerce"
  | "landing"
  | "custom";

export type ProjectCategory =
  | "Business"
  | "Portfolio"
  | "E-commerce"
  | "Landing"
  | "Application";

export type Service = {
  id: ServiceId;
  title: string;
  shortDescription: string;
  description: string;
  features: string[];
  technologies: string[];
};

export type Project = {
  id: string;
  title: string;
  description: string;
  category: ProjectCategory;
  image: string;
  technologies: string[];
  liveUrl: string;
  githubUrl?: string;
  featured: boolean;
};

export type SkillGroup = {
  category: string;
  skills: string[];
};

export type ProcessStep = {
  step: string;
  title: string;
  description: string;
};

export type Reason = {
  title: string;
  description: string;
};

export type NavItem = {
  href: string;
  label: string;
};

export type SocialLink = {
  label: string;
  href: string;
};
