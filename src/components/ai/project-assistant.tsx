"use client";

import { DifyChatbot } from "@/components/ai/dify-chatbot";

/**
 * The custom chat UI was replaced by Dify's official embedded chatbot.
 * This export remains so any leftover import still loads the widget.
 */
export function ProjectAssistant() {
  return <DifyChatbot />;
}
