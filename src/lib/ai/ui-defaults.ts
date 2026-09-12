import type { AiUiConfig } from "@/types/ai";

/**
 * Neutral last resort used only when Dify's configuration cannot be loaded, so
 * the assistant still works. Never the primary source: Dify owns Nora's name,
 * avatar, opening message, suggested questions and input placeholder.
 *
 * `suggestedQuestions` is intentionally empty — questions are never invented.
 * Dify's `suggested_questions` is the only source, and the section is hidden
 * when Dify returns none.
 */
export const DEFAULT_AI_UI_CONFIG: AiUiConfig = {
  name: "Project assistant",
  avatar: null,
  avatarType: null,
  welcomeMessage:
    "Ask about websites, web apps, process, or how to start. I only answer from published information — if something is not listed, I will say so.",
  suggestedQuestions: [],
  inputPlaceholder: "Ask about a website or web app…",
  themeColor: null,
  configSource: "fallback",
};
