/**
 * Normalises the text of an assistant reply before it can be seen.
 *
 * Nora's model sometimes wraps its answer in internal reasoning, e.g.
 * `<think> We need to answer... </think> I build custom websites...`, and some
 * chatflow versions wrap the whole answer in a JSON envelope. That reasoning is
 * private: it must never be rendered, stored for display, or summarised.
 *
 * This module is pure and dependency-free so the exact same normalisation runs
 * on the server (when Dify's answer is parsed, so nothing pollutes the database)
 * and on the client (when a message is rendered, so already-stored rows and
 * cached payloads can never leak it either).
 */

/** Tag names that must never be displayed when they carry reasoning. */
const REASONING_TAGS = ["think", "thinking", "reasoning", "analysis", "scratchpad"];
const TAG_ALTERNATION = REASONING_TAGS.join("|");

/**
 * A complete reasoning block, any case, across any number of lines. The tag is
 * captured so the backreference in `\1` keeps the closing tag matched to its own
 * opening tag (`<think>…</thinking>` must not pair up).
 */
const REASONING_BLOCK = new RegExp(
  `<\\s*(${TAG_ALTERNATION})\\s*>[\\s\\S]*?<\\s*\\/\\s*\\1\\s*>`,
  "gi",
);

/** A stray closing tag whose opening tag was already removed. */
const REASONING_CLOSE = new RegExp(`<\\s*\\/\\s*(?:${TAG_ALTERNATION})\\s*>`, "gi");

/** An opening tag with no closing tag (e.g. a truncated stream). */
const REASONING_OPEN = new RegExp(`<\\s*(?:${TAG_ALTERNATION})\\s*>`, "i");

/**
 * JSON keys that mean "this object is only a transport wrapper around the final
 * answer". Deliberately does NOT include `message` / `action`, which the Dify
 * adapter uses for its own structured reply (including the CTA).
 */
const ENVELOPE_KEYS = ["answer", "text", "output", "response", "result", "content"];

const FENCED_BLOCK = /^```(?:json|text)?\s*\n?([\s\S]*?)\n?```$/i;

const MAX_UNWRAP_DEPTH = 3;
const MAX_PASSES = 4;

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? value : null;
}

/**
 * Unwraps `{"answer": "..."}`-style transports (optionally inside a ```json
 * fence) and returns null when the text is ordinary prose. Only a payload whose
 * *entire* body is such an object qualifies, so braces inside normal writing are
 * never touched.
 */
function unwrapEnvelope(value: string, depth: number): string | null {
  const trimmed = value.trim();
  const fenced = trimmed.match(FENCED_BLOCK);
  const inner = (fenced ? fenced[1] : trimmed).trim();

  if (!inner.startsWith("{") || !inner.endsWith("}")) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(inner);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  const key = ENVELOPE_KEYS.find((candidate) => asString(record[candidate]) !== null);
  if (!key) {
    return null;
  }

  const unwrapped = record[key] as string;
  if (depth < MAX_UNWRAP_DEPTH) {
    const nested = unwrapEnvelope(unwrapped, depth + 1);
    if (nested !== null) {
      return nested;
    }
  }
  return unwrapped;
}

function removeReasoningBlocks(value: string): string {
  let text = value;

  // Several blocks (including nested-looking leftovers) can appear in one reply.
  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const next = text.replace(REASONING_BLOCK, "");
    if (next === text) {
      break;
    }
    text = next;
  }

  text = text.replace(REASONING_CLOSE, "");

  // An opening tag with no partner means the reasoning was cut off mid-stream:
  // everything from that tag onwards is internal, so it is dropped.
  const openIndex = text.search(REASONING_OPEN);
  if (openIndex >= 0) {
    text = text.slice(0, openIndex);
  }

  return text;
}

/**
 * Returns only the visitor-visible part of an assistant reply:
 * every `<think>`-style block (any case, multiline, repeated, or truncated) is
 * removed, known JSON transports are unwrapped, and the surrounding whitespace
 * is tidied. Never throws — the input is always safe to render.
 */
export function stripInternalReasoning(input: string): string {
  if (typeof input !== "string" || input.length === 0) {
    return "";
  }

  let text = input.replace(/\r\n?/g, "\n");

  // Reason -> unwrap -> reason again: an envelope may itself contain a block,
  // and an unwrapped value may contain another envelope.
  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const before = text;
    text = removeReasoningBlocks(text);

    const unwrapped = unwrapEnvelope(text, 0);
    if (unwrapped !== null) {
      text = unwrapped;
    }

    if (text === before) {
      break;
    }
  }

  text = removeReasoningBlocks(text);

  // Only the edges are tidied: removing a leading block leaves the blank lines
  // that surrounded it, while indentation *inside* the answer is preserved.
  return text
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s+/, "")
    .replace(/\s+$/, "");
}
