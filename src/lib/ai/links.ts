import { AI_ROUTE_CATALOG } from "@/lib/ai/cta";

/**
 * Client-safe link helpers for assistant messages.
 *
 * The chat UI renders an assistant message as plain text, so markdown links Nora
 * writes ("[Services](/services)") were shown literally and nothing was
 * clickable. These helpers do the smallest thing that fixes that: they split a
 * message into text/link nodes and refuse anything that is not a same-origin
 * relative path or an http(s) URL, so `javascript:`, `data:` and every other
 * scheme can never reach the DOM.
 *
 * No new dependency and no new component system: the existing paragraph styling
 * and the existing CTA button (message.cta) are untouched.
 */

export type MessageLinkNode = {
  type: "link";
  /** Visible link text. */
  label: string;
  /** Resolved, safe destination. */
  href: string;
  /** true when the link leaves the site (opened in a new tab). */
  external: boolean;
};

export type MessageTextNode = { type: "text"; text: string };

export type MessageNode = MessageTextNode | MessageLinkNode;

/** Route key -> href, reused from the single existing route catalog. */
const PAGE_ROUTES: Record<string, string> = Object.fromEntries(
  AI_ROUTE_CATALOG.map((route) => [route.key, route.href]),
);

/**
 * Resolves a destination to something safe to render.
 *
 * Allowed: same-origin relative paths ("/services") and explicit http(s) URLs.
 * Everything else - `javascript:`, `data:`, `mailto:`, protocol-relative
 * "//host", bare words, control characters, whitespace - returns null, and the
 * caller then renders the original text instead of a link.
 */
export function resolveMessageHref(
  raw: string | null | undefined,
): { href: string; external: boolean } | null {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) {
    return null;
  }

  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 0x1f || code === 0x7f || char === "\\" || /\s/.test(char)) {
      return null;
    }
  }

  if (value.startsWith("/")) {
    // "//evil.test" is protocol-relative, not a same-origin path.
    return value.startsWith("//") ? null : { href: value, external: false };
  }

  if (!/^https?:\/\//i.test(value)) {
    return null;
  }

  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return { href: url.toString(), external: true };
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * A small, bounded set of plain-text page mentions that are unambiguous enough to
 * link safely, so Nora's prose ("explore my services on the Services page") is
 * clickable too. Deliberately narrow: bare words like "services" or "about" are
 * ordinary English, so only page-qualified or multi-word phrases are linked, and
 * only in plain text runs - never inside a markdown link or a code span.
 */
const PHRASE_LINKS: readonly {
  pattern: RegExp;
  href: (match: RegExpMatchArray) => string | null;
}[] = [
  {
    pattern: /\b(?:start (?:a|your) project|get started)\b/i,
    href: () => PAGE_ROUTES["start-project"] ?? null,
  },
  {
    pattern: /\bproject assistant\b/i,
    href: () => PAGE_ROUTES["ai-assistant"] ?? null,
  },
  {
    pattern: /\b(services|projects|about|contact|home) page\b/i,
    href: (match) => PAGE_ROUTES[match[1].toLowerCase()] ?? null,
  },
];

type PhraseMatch = { index: number; length: number; label: string; href: string };

function linkNodes(label: string, href: string): MessageNode[] {
  const resolved = resolveMessageHref(href);
  if (!resolved) {
    // Unsafe destination: keep the original text rather than dropping content.
    return [{ type: "text", text: `[${label}](${href})` }];
  }
  return [
    {
      type: "link",
      label: label || resolved.href,
      href: resolved.href,
      external: resolved.external,
    },
  ];
}

/** Links at most one occurrence per phrase, earliest first, without overlaps. */
function mentionNodes(run: string): MessageNode[] {
  if (!run) {
    return [];
  }

  const found: PhraseMatch[] = [];
  for (const entry of PHRASE_LINKS) {
    const match = entry.pattern.exec(run);
    if (!match) {
      continue;
    }
    const href = entry.href(match);
    if (href) {
      found.push({ index: match.index, length: match[0].length, label: match[0], href });
    }
  }

  if (found.length === 0) {
    return [{ type: "text", text: run }];
  }

  found.sort((a, b) => a.index - b.index);

  const nodes: MessageNode[] = [];
  let cursor = 0;
  for (const match of found) {
    if (match.index < cursor) {
      // Overlaps a phrase that was already linked; keep the earlier one.
      continue;
    }
    if (match.index > cursor) {
      nodes.push({ type: "text", text: run.slice(cursor, match.index) });
    }
    nodes.push(...linkNodes(match.label, match.href));
    cursor = match.index + match.length;
  }

  if (cursor < run.length) {
    nodes.push({ type: "text", text: run.slice(cursor) });
  }

  return nodes;
}

/**
 * Markdown links, inline code spans and bare http(s) URLs. Code spans are matched
 * too so that a URL inside `backticks` stays literal and is never auto-linked.
 */
const TOKEN_PATTERN =
  /\[([^\]\n]+)\]\(([^()\s]+)(?:\s+"[^"]*")?\)|(`[^`\n]+`)|(https?:\/\/[^\s<>()"']+)/gi;

const TRAILING_PUNCTUATION = /[.,;:!?]+$/;

/** Splits message text into the exact nodes the chat UI renders. */
export function parseMessageContent(content: string): MessageNode[] {
  const text = typeof content === "string" ? content : "";
  if (!text) {
    return [];
  }

  const nodes: MessageNode[] = [];
  let cursor = 0;

  TOKEN_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null = TOKEN_PATTERN.exec(text);

  while (match !== null) {
    if (match.index > cursor) {
      nodes.push(...mentionNodes(text.slice(cursor, match.index)));
    }

    const [whole, markdownLabel, markdownHref, code, bareUrl] = match;

    if (markdownLabel !== undefined && markdownHref !== undefined) {
      nodes.push(...linkNodes(markdownLabel, markdownHref));
    } else if (code === undefined && bareUrl !== undefined) {
      // Sentence punctuation is not part of the URL.
      const trailing = TRAILING_PUNCTUATION.exec(bareUrl)?.[0] ?? "";
      const url = trailing ? bareUrl.slice(0, -trailing.length) : bareUrl;
      const resolved = resolveMessageHref(url);
      nodes.push(
        resolved
          ? { type: "link", label: url, href: resolved.href, external: resolved.external }
          : { type: "text", text: url },
      );
      if (trailing) {
        nodes.push({ type: "text", text: trailing });
      }
    } else {
      // Inline code: rendered literally, exactly as the current UI does.
      nodes.push({ type: "text", text: whole });
    }

    cursor = match.index + whole.length;
    match = TOKEN_PATTERN.exec(text);
  }

  if (cursor < text.length) {
    nodes.push(...mentionNodes(text.slice(cursor)));
  }

  return nodes;
}
