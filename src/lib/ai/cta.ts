import type { AiCta } from "@/types/ai";

const HIRING_INTENT =
  /\b(hire|hiring|quote|quotes|pricing|price|budget|cost|estimate|proposal|start(ing)? a project|start a website|new website|web app|need a (site|website|app)|work with you|available|availability|timeline|deadline|get started|book|commission)\b/i;

export function detectHiringIntent(message: string): boolean {
  return HIRING_INTENT.test(message);
}

export function buildCta(input: {
  showCta: boolean;
  reason: string | null;
  userMessage: string;
  label: string;
  href: string;
}): AiCta | null {
  const hiring = input.showCta || detectHiringIntent(input.userMessage);
  if (!hiring) {
    return null;
  }

  return {
    label: input.label,
    href: input.href,
    reason: input.reason,
  };
}
