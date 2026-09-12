"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";
import {
  DIFY_BUBBLE_BUTTON_ID,
  DIFY_BUBBLE_WINDOW_ID,
  DIFY_EMBED_BASE_URL,
  DIFY_EMBED_CONFIG_SCRIPT_ID,
  DIFY_EMBED_DYNAMIC_SCRIPT,
  DIFY_EMBED_SCRIPT_ID,
  DIFY_EMBED_SCRIPT_SRC,
  DIFY_EMBED_TOKEN,
} from "@/lib/ai/dify-embed";

declare global {
  interface Window {
    difyChatbotConfig?: {
      token: string;
      baseUrl: string;
      dynamicScript: boolean;
      inputs: Record<string, string>;
      systemVariables: Record<string, string>;
      userVariables: Record<string, string>;
    };
  }
}

/**
 * The official embed reads `window.difyChatbotConfig` when embed.min.js
 * executes, so this string is rendered as an inline script *before* the embed
 * script tag — the same order as Dify's own snippet.
 */
const DIFY_EMBED_CONFIG = `window.difyChatbotConfig={token:${JSON.stringify(
  DIFY_EMBED_TOKEN,
)},baseUrl:${JSON.stringify(
  DIFY_EMBED_BASE_URL,
)},dynamicScript:${JSON.stringify(
  DIFY_EMBED_DYNAMIC_SCRIPT,
)},inputs:{},systemVariables:{},userVariables:{}};`;

/**
 * Minimal styling only — the widget itself (button, window, composer, Send
 * button, message history) is entirely Dify's.
 *
 * Dify positions the iframe *inside* the 48px bubble button, so the window's
 * own `bottom` is measured from the button. A 3.5rem offset lifts the window
 * clear of the button, which would otherwise sit on top of the bottom-right of
 * the window — the composer/Send area.
 *
 * The button offset is set through Dify's own supported CSS variables so the
 * safe-area inset is respected without fighting Dify's inline styles. Height
 * and width are deliberately *not* forced: Dify already sizes the window
 * (`width: 24rem; max-width: calc(100vw - 2rem)`), and pinning an exact height
 * is what clips the bottom of the widget on short mobile viewports. Only a
 * `dvh`-based cap is applied, so the window always fits the visible viewport.
 */
const DIFY_EMBED_STYLE = `
:root {
  --dify-chatbot-bubble-button-right: max(1rem, env(safe-area-inset-right, 0px));
  --dify-chatbot-bubble-button-bottom: max(1rem, env(safe-area-inset-bottom, 0px));
  --dify-chatbot-bubble-button-bg-color: #1C64F2;
}
#${DIFY_BUBBLE_WINDOW_ID} {
  bottom: 3.5rem !important;
  max-height: calc(100dvh - var(--dify-chatbot-bubble-button-bottom, 1rem) - 4.5rem) !important;
  max-width: calc(100vw - 1.5rem) !important;
}
`;

function applyDifyConfig() {
  window.difyChatbotConfig = {
    token: DIFY_EMBED_TOKEN,
    baseUrl: DIFY_EMBED_BASE_URL,
    dynamicScript: DIFY_EMBED_DYNAMIC_SCRIPT,
    inputs: {},
    systemVariables: {},
    userVariables: {},
  };
}

/** True while Dify's chat window exists and is open. */
function isWidgetOpen(): boolean {
  const frame = document.getElementById(DIFY_BUBBLE_WINDOW_ID);
  if (!(frame instanceof HTMLElement)) {
    return false;
  }
  const style = window.getComputedStyle(frame);
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    frame.getClientRects().length > 0
  );
}

/**
 * Toggle the widget with Dify's own button. The button only exists once
 * embed.min.js has run, so callers retry until it appears.
 */
function toggleWidget(): boolean {
  const button = document.getElementById(DIFY_BUBBLE_BUTTON_ID);
  if (!(button instanceof HTMLElement)) {
    return false;
  }
  if (window.getComputedStyle(button).display === "none") {
    return false;
  }
  button.click();
  return true;
}

export function DifyChatbot({ autoOpen = true }: { autoOpen?: boolean }) {
  const openedRef = useRef(false);

  useEffect(() => {
    // Also set here so the config is present whenever this component mounts,
    // whatever order the two script tags are injected in.
    applyDifyConfig();

    if (!autoOpen) {
      return;
    }

    // embed.min.js loads asynchronously, so poll briefly for the bubble button
    // and use Dify's own toggle to open the window exactly once.
    let attempts = 0;
    let intervalId: number | null = null;

    const tryOpen = () => {
      attempts += 1;
      if (isWidgetOpen()) {
        openedRef.current = true;
      } else if (!openedRef.current) {
        toggleWidget();
      }
      if (openedRef.current || attempts >= 40) {
        if (intervalId !== null) {
          window.clearInterval(intervalId);
          intervalId = null;
        }
      }
    };

    tryOpen();
    if (!openedRef.current) {
      intervalId = window.setInterval(tryOpen, 250);
    }

    return () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
      // Leaving the page closes the window through Dify's own toggle, so the
      // widget is never left hanging open on another route. It is never
      // removed or re-created: Dify owns the single global instance.
      if (isWidgetOpen()) {
        toggleWidget();
      }
    };
  }, [autoOpen]);

  return (
    <>
      <Script id={DIFY_EMBED_CONFIG_SCRIPT_ID} strategy="afterInteractive">
        {DIFY_EMBED_CONFIG}
      </Script>
      <Script
        id={DIFY_EMBED_SCRIPT_ID}
        src={DIFY_EMBED_SCRIPT_SRC}
        strategy="afterInteractive"
      />
      <style>{DIFY_EMBED_STYLE}</style>
    </>
  );
}
