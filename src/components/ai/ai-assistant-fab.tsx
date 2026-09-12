"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { AssistantAvatar } from "@/components/ai/assistant-avatar";
import {
  getAiConfigCacheSnapshot,
  getServerAiConfigSnapshot,
  loadAiUiConfig,
  subscribeAiConfigCache,
} from "@/lib/ai/client";
import { DEFAULT_AI_UI_CONFIG } from "@/lib/ai/ui-defaults";

const HIDDEN_PREFIXES = ["/admin", "/ai-assistant"];
const HIDDEN_CHAT =
  /^\/profile\/(?:projects\/[^/]+\/messages|project-requests\/[^/]+\/messages)$/;

const WELCOME_DISMISSED_KEY = "nora-welcome-dismissed";

const welcomeListeners = new Set<() => void>();

function subscribeWelcomeDismissed(listener: () => void): () => void {
  welcomeListeners.add(listener);
  return () => {
    welcomeListeners.delete(listener);
  };
}

/** Primitives only, so the snapshot is safe to compare by value. */
function getWelcomeDismissedSnapshot(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.sessionStorage.getItem(WELCOME_DISMISSED_KEY) === "true";
  } catch {
    return false;
  }
}

function getWelcomeDismissedServerSnapshot(): boolean {
  return false;
}

/** Hides the teaser for the rest of the browser session. Never touches the chat. */
function dismissWelcome(): void {
  try {
    window.sessionStorage.setItem(WELCOME_DISMISSED_KEY, "true");
  } catch {
    // Storage unavailable: the teaser simply comes back on the next render.
  }
  for (const listener of welcomeListeners) {
    listener();
  }
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Floating Nora launcher — a teaser only. Clicking it opens the existing
 * `/ai-assistant` page, which owns the conversation; this component never talks
 * to `/api/ai/chat`.
 *
 * Everything about Nora (name, avatar, welcome text) comes from Dify through
 * `/api/ai/config`, read through the shared config cache so the launcher and the
 * chat page never issue duplicate requests.
 */
export function AiAssistantFab() {
  const pathname = usePathname();
  const cachedConfig = useSyncExternalStore(
    subscribeAiConfigCache,
    getAiConfigCacheSnapshot,
    getServerAiConfigSnapshot,
  );
  const dismissed = useSyncExternalStore(
    subscribeWelcomeDismissed,
    getWelcomeDismissedSnapshot,
    getWelcomeDismissedServerSnapshot,
  );

  // Reuses the 5-minute cache: this only reaches the network when the cached
  // configuration is missing or older than its TTL.
  useEffect(() => {
    void loadAiUiConfig().catch(() => undefined);
  }, []);

  if (
    HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ||
    HIDDEN_CHAT.test(pathname)
  ) {
    return null;
  }

  const config = cachedConfig ?? DEFAULT_AI_UI_CONFIG;
  const openingMessage = config.openingMessage.trim();
  // Only Dify's own opening statement is shown: the local fallback is never
  // presented as Nora's welcome.
  const showWelcome = !dismissed && config.configSource === "dify" && openingMessage.length > 0;

  return (
    <div className="fixed right-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-40 flex flex-col items-end gap-3 sm:right-6">
      {showWelcome ? (
        <div
          // The site's `fade-up` keyframes are reused, but only applied when the
          // visitor has NOT asked for reduced motion. (The `animate-fade-up`
          // class cannot be cancelled with `motion-reduce:animate-none`, because
          // globals.css is appended after the utilities and wins the cascade.)
          className="relative max-w-[min(19rem,calc(100vw-2rem))] rounded-2xl rounded-br-md border border-card-border bg-card px-4 py-3 pr-10 text-sm leading-6 text-foreground shadow-[0_12px_32px_rgba(20,20,20,0.14)] motion-safe:[animation:fade-up_0.5s_ease-out_both]"
          role="status"
        >
          <button
            type="button"
            onClick={dismissWelcome}
            aria-label="Close message"
            title="Close message"
            className="absolute top-1.5 right-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-accent-soft hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
          >
            <CloseIcon />
          </button>
          <p className="text-[10px] font-medium tracking-[0.18em] text-muted uppercase">
            {config.name}
          </p>
          <p className="mt-1 whitespace-pre-wrap">{openingMessage}</p>
          {/* Pointer toward the avatar below */}
          <span
            aria-hidden
            className="absolute -bottom-1.5 right-6 h-3 w-3 rotate-45 border-r border-b border-card-border bg-card"
          />
        </div>
      ) : null}

      <Link
        href="/ai-assistant"
        aria-label={`Chat with ${config.name}`}
        title={`Chat with ${config.name}`}
        className="group relative inline-flex h-14 w-14 items-center justify-center rounded-full border border-card-border bg-card shadow-[0_10px_28px_rgba(20,20,20,0.16)] transition-transform transition-colors hover:border-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        <span className="transition-transform duration-200 ease-out group-hover:scale-[1.04] motion-reduce:transform-none motion-reduce:transition-none">
          <AssistantAvatar size={52} />
        </span>
        {/* Online indicator: purely visual, never colour-only (the link carries
            the accessible label and this has a screen-reader equivalent). */}
        <span
          aria-hidden
          className="pointer-events-none absolute right-0 bottom-0 inline-flex h-3.5 w-3.5 items-center justify-center"
        >
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500/60 motion-safe:animate-ping motion-reduce:hidden" />
          <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-card bg-emerald-500 shadow-[0_0_0_1px_rgba(16,185,129,0.35),0_0_6px_rgba(16,185,129,0.55)]" />
        </span>
        <span className="sr-only">Nora is online. Chat with {config.name}</span>
      </Link>
    </div>
  );
}
