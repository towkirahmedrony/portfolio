import type { AiUiConfig } from "@/types/ai";

export const DEFAULT_AI_UI_CONFIG: AiUiConfig = {
  name: "Project assistant",
  avatar: null,
  avatarType: null,
  welcomeMessage:
    "Ask about websites, web apps, process, or how to start. I only answer from published information — if something is not listed, I will say so.",
  suggestedQuestions: [
    "What kind of websites do you build?",
    "Can you help with a web app?",
    "How do I start a project?",
  ],
  inputPlaceholder: "Ask about a website or web app…",
  themeColor: null,
};
