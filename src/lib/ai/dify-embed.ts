/**
 * Official Dify embedded chatbot configuration.
 *
 * These values come from the Dify app's Access Point tab ("Embed Into Site")
 * and must stay in sync with it.
 */
export const DIFY_EMBED_TOKEN = "JJJAG3buEHt2zB4O";
export const DIFY_EMBED_BASE_URL = "https://udify.app";
export const DIFY_EMBED_SCRIPT_SRC = `${DIFY_EMBED_BASE_URL}/embed.min.js`;

/** The embed script's `id` attribute. Dify's snippet uses the app token here. */
export const DIFY_EMBED_SCRIPT_ID = DIFY_EMBED_TOKEN;

export const DIFY_EMBED_CONFIG_SCRIPT_ID = "dify-chatbot-config";

/**
 * Required for this app.
 *
 * Dify's embed.min.js ends with `y?.dynamicScript ? init() : document.body.onload = init`,
 * i.e. it self-initialises on the window `load` event unless this flag is set.
 * The official snippet puts the script in the document with `defer`, so it runs
 * during the initial parse and the one-shot `load` event still reaches it.
 * Next.js cannot do that: `next/script` with `strategy="afterInteractive"`
 * appends the script from a React effect, which happens after hydration — and
 * on a client-side route change no `load` event will ever fire again. Without
 * this flag the widget therefore never boots, and the observable symptom is a
 * chat window with no message composer and no Send button.
 *
 * With the flag set, embed.min.js initialises as soon as it executes, which is
 * safe to run more than once: Dify itself guards both the bubble button
 * (`document.getElementById(BUTTON_ID) || create()`) and the window toggle, and
 * Next.js only ever injects the script once per `id`/`src`.
 */
export const DIFY_EMBED_DYNAMIC_SCRIPT = true;

/** DOM ids created by embed.min.js. */
export const DIFY_BUBBLE_BUTTON_ID = "dify-chatbot-bubble-button";
export const DIFY_BUBBLE_WINDOW_ID = "dify-chatbot-bubble-window";
