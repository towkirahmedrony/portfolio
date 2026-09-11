import type { AiCta } from "@/types/ai";

export type AiRouteKey =
  | "home"
  | "services"
  | "projects"
  | "about"
  | "contact"
  | "start-project"
  | "login"
  | "signup"
  | "ai-assistant";

export type AiRouteDefinition = {
  key: AiRouteKey;
  href: string;
  label: string;
  description: string;
};

export const AI_ROUTE_CATALOG: readonly AiRouteDefinition[] = [
  { key: "home", href: "/", label: "Home", description: "Website home page" },
  {
    key: "services",
    href: "/services",
    label: "View Services",
    description: "Published web development services",
  },
  {
    key: "projects",
    href: "/projects",
    label: "View Projects",
    description: "Published portfolio and previous work",
  },
  {
    key: "about",
    href: "/about",
    label: "About",
    description: "About the developer",
  },
  {
    key: "contact",
    href: "/contact",
    label: "Contact",
    description: "Contact the developer",
  },
  {
    key: "start-project",
    href: "/start-project",
    label: "Start a Project",
    description: "Start a project / request a quote",
  },
  { key: "login", href: "/login", label: "Log in", description: "Customer log in" },
  {
    key: "signup",
    href: "/signup",
    label: "Sign up",
    description: "Create a customer account",
  },
  {
    key: "ai-assistant",
    href: "/ai-assistant",
    label: "Project Assistant",
    description: "This assistant",
  },
] as const;

const ROUTES_BY_KEY = new Map<string, AiRouteDefinition>(
  AI_ROUTE_CATALOG.map((route) => [route.key, route]),
);

const ROUTES_BY_HREF = new Map<string, AiRouteDefinition>(
  AI_ROUTE_CATALOG.map((route) => [route.href, route]),
);

const HIRING_INTENT =
  /\b(hire|hiring|quote|quotes|pricing|price|budget|cost|estimate|proposal|start(ing)? a project|start a website|new website|web app|need a (site|website|app)|work with you|get started|book|commission)\b/i;
const SERVICES_INTENT =
  /\b(services?|what (do you|you can) (do|offer|build)|what kind of (sites?|websites?|apps?)|offerings?)\b/i;
const PROJECTS_INTENT =
  /\b(projects?|portfolio|previous work|past work|examples?|case stud(?:y|ies)|show me (your )?work)\b/i;
const CONTACT_INTENT =
  /\b(contact|email you|whatsapp|reach (you|him|shakib)|get in touch|talk to (you|him|shakib))\b/i;
const ABOUT_INTENT =
  /\b(about (you|him|shakib|the developer)|who (are you|is shakib)|your (background|bio|story|experience))\b/i;
const LOGIN_INTENT = /\b(log ?in|sign ?in)\b/i;
const SIGNUP_INTENT = /\b(sign ?up|create an account|register)\b/i;

export function isAiRouteKey(value: string | null | undefined): value is AiRouteKey {
  return Boolean(value && ROUTES_BY_KEY.has(value));
}

export function getRouteByKey(key: string | null | undefined): AiRouteDefinition | null {
  if (!key) {
    return null;
  }
  return ROUTES_BY_KEY.get(key.trim().toLowerCase()) ?? null;
}

export function getRouteByHref(href: string | null | undefined): AiRouteDefinition | null {
  if (!href) {
    return null;
  }
  const normalized = href.trim();
  if (!normalized.startsWith("/") || normalized.startsWith("//")) {
    return null;
  }
  return ROUTES_BY_HREF.get(normalized) ?? null;
}

export function isAllowedInternalHref(href: string): boolean {
  return getRouteByHref(href) !== null;
}

export function detectHiringIntent(message: string): boolean {
  return HIRING_INTENT.test(message);
}

export function detectActionKey(message: string): AiRouteKey | null {
  const text = message.trim();
  if (!text) {
    return null;
  }
  if (HIRING_INTENT.test(text)) {
    return "start-project";
  }
  if (SIGNUP_INTENT.test(text)) {
    return "signup";
  }
  if (LOGIN_INTENT.test(text)) {
    return "login";
  }
  if (CONTACT_INTENT.test(text)) {
    return "contact";
  }
  if (PROJECTS_INTENT.test(text)) {
    return "projects";
  }
  if (SERVICES_INTENT.test(text)) {
    return "services";
  }
  if (ABOUT_INTENT.test(text)) {
    return "about";
  }
  return null;
}

export function formatRouteCatalogForPrompt(): string {
  return AI_ROUTE_CATALOG.map(
    (route) => `- ${route.key}: "${route.label}" (${route.description})`,
  ).join("\n");
}

function ctaFromRoute(
  route: AiRouteDefinition,
  reason: string | null,
  overrides?: { label?: string; href?: string },
): AiCta {
  const href =
    overrides?.href && isAllowedInternalHref(overrides.href)
      ? overrides.href
      : route.href;
  return {
    label: overrides?.label?.trim() || route.label,
    href,
    reason,
  };
}

export function buildCta(input: {
  actionKey?: string | null;
  showCta?: boolean;
  reason: string | null;
  userMessage: string;
  label?: string;
  href?: string;
}): AiCta | null {
  const fromModel = getRouteByKey(input.actionKey);
  if (fromModel) {
    const overrides =
      fromModel.key === "start-project"
        ? { label: input.label, href: input.href }
        : undefined;
    return ctaFromRoute(fromModel, input.reason, overrides);
  }

  if (input.showCta) {
    const start = getRouteByKey("start-project");
    if (!start) {
      return null;
    }
    return ctaFromRoute(start, input.reason, { label: input.label, href: input.href });
  }

  const detected = detectActionKey(input.userMessage);
  if (!detected) {
    return null;
  }

  const route = getRouteByKey(detected);
  if (!route) {
    return null;
  }

  const overrides =
    detected === "start-project"
      ? { label: input.label, href: input.href }
      : undefined;
  return ctaFromRoute(route, input.reason, overrides);
}
