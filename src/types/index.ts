/**
 * Public display models for portfolio / services content.
 *
 * These are read-only view models hydrated from Supabase
 * (portfolio_projects + portfolio_project_images, services + service_features —
 * see src/lib/public-content.ts). They intentionally stay decoupled from the
 * database row types in src/types/database.ts.
 */

export type Project = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string | null;
  image: string | null; // portfolio_projects.thumbnail_url
  technologies: string[];
  liveUrl: string | null;
  githubUrl: string | null;
  featured: boolean;
};

export type Service = {
  id: string;
  slug: string;
  title: string; // services.name
  shortDescription: string | null;
  description: string | null;
  startingPrice: number | null;
  currency: string;
  estimatedDaysMin: number | null;
  estimatedDaysMax: number | null;
  features: string[]; // service_features.feature, ordered by sort_order
  featured: boolean;
  image: string | null;
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
