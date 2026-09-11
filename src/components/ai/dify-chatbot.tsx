"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";
import {
  DIFY_BUBBLE_BUTTON_ID,
  DIFY_BUBBLE_WINDOW_ID,
  DIFY_EMBED_BASE_URL,
  DIFY_EMBED_CONFIG_SCRIPT_ID,
  DIFY_EMBED_SCRIPT_ID,
  DIFY_EMBED_SCRIPT_SRC,
  DIFY_EMBED_TOKEN,
} from "@/lib/ai/dify-embed";

declare global {
  interface Window {
    difyChatbotConfig?: {
      token: string;
      baseUrl: string;
      inputs: Record<string, string>;
      systemVariables: Record<string, string>;
      userVariables: Record<string, string>;
    };
  }
}

const DIFY_EMBED_STYLE = `
#${DIFY_BUBBLE_BUTTON_ID} {
  background-color: #1C64F2 !important;
  right: max(1rem, env(safe-area-inset-right, 0px)) !important;
  bottom: max(1.25rem, env(safe-area-inset-bottom, 0px)) !important;
}
#${DIFY_BUBBLE_WINDOW_ID} {
  width: min(24rem, calc(100vw - 1.5rem)) !important;
  height: min(40rem, calc(100dvh - 7rem)) !important;
  max-width: calc(100vw - 1rem) !important;
  max-height: calc(100dvh - 5.5rem - env(safe-area-inset-bottom, 0px)) !important;
  right: max(0.5rem, env(safe-area-inset-right, 0px)) !important;
  bottom: max(4.5rem, calc(env(safe-area-inset-bottom, 0px) + 3.5rem)) !important;
}
@media (max-width: 640px) {
  #${DIFY_BUBBLE_WINDOW_ID} {
    width: calc(100vw - 1rem) !important;
    height: min(40rem, calc(100dvh - 5.5rem - env(safe-area-inset-bottom, 0px))) !important;
    max-width: none !important;
    right: 0.5rem !important;
    left: auto !important;
    bottom: max(4.25rem, calc(env(safe-area-inset-bottom, 0px) + 3.25rem)) !important;
  }
}
`;

function applyDifyConfig() {
  window.difyChatbotConfig = {
    token: DIFY_EMBED_TOKEN,
    baseUrl: DIFY_EMBED_BASE_URL,
    inputs: {},
    systemVariables: {},
    userVariables: {},
  };
}

function isVisible(element: HTMLElement | null): boolean {
  if (!element) {
    return false;
  }
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") {
    return false;
  }
  return element.getClientRects().length > 0;
}

function setButtonHidden(hidden: boolean) {
  const button = document.getElementById(DIFY_BUBBLE_BUTTON_ID);
  const frame = document.getElementById(DIFY_BUBBLE_WINDOW_ID);
  if (button instanceof HTMLElement) {
    if (hidden) {
      button.style.setProperty("display", "none", "important");
    } else {
      button.style.removeProperty("display");
    }
  }
  if (frame instanceof HTMLElement) {
    if (hidden) {
      frame.style.setProperty("display", "none", "important");
    } else {
      frame.style.removeProperty("display");
    }
  }
}

function openDifyWindow(): boolean {
  const button = document.getElementById(DIFY_BUBBLE_BUTTON_ID);
  if (!(button instanceof HTMLElement)) {
    return false;
  }
  if (window.getComputedStyle(button).display === "none") {
    return false;
  }
  const frame = document.getElementById(DIFY_BUBBLE_WINDOW_ID);
  if (frame instanceof HTMLElement && isVisible(frame)) {
    return true;
  }
  button.click();
  return true;
}

export function DifyChatbot({ autoOpen = true }: { autoOpen?: boolean }) {
  const openedRef = useRef(false);

  useEffect(() => {
    applyDifyConfig();
    setButtonHidden(false);
    openedRef.current = false;

    if (!autoOpen) {
      return () => {
        setButtonHidden(true);
      };
    }

    let intervalId: number | null = null;
    let timeoutId: number | null = null;

    const tryOpen = () => {
      if (openedRef.current) {
        return;
      }
      if (openDifyWindow()) {
        openedRef.current = true;
        if (intervalId !== null) {
          window.clearInterval(intervalId);
          intervalId = null;
        }
      }
    };

    tryOpen();
    if (!openedRef.current) {
      intervalId = window.setInterval(tryOpen, 250);
      timeoutId = window.setTimeout(() => {
        if (intervalId !== null) {
          window.clearInterval(intervalId);
          intervalId = null;
        }
      }, 8000);
    }

    return () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      setButtonHidden(true);
    };
  }, [autoOpen]);

  return (
    <>
      <Script id={DIFY_EMBED_CONFIG_SCRIPT_ID} strategy="afterInteractive">
        {`window.difyChatbotConfig={token:${JSON.stringify(DIFY_EMBED_TOKEN)},baseUrl:${JSON.stringify(DIFY_EMBED_BASE_URL)},inputs:{},systemVariables:{},userVariables:{}};`}
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
