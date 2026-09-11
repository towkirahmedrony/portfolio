"use client";

import Link from "next/link";
import { parseMessageContent } from "@/lib/ai/links";

/**
 * Existing theme tokens only, so the chat looks the same apart from the links
 * being clickable.
 */
const LINK_CLASS =
  "rounded-sm font-medium text-accent underline decoration-accent/40 underline-offset-2 transition-colors hover:decoration-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * Renders one chat message. Text is otherwise untouched - the only change from
 * the previous plain paragraph is that safe links become real links: internal
 * destinations use next/link, external http(s) URLs open in a new tab, and
 * anything unsafe (javascript:, data:, ...) stays plain text.
 */
export function MessageText({
  content,
  showCursor = false,
}: {
  content: string;
  showCursor?: boolean;
}) {
  const nodes = parseMessageContent(content);

  return (
    <p className="whitespace-pre-wrap break-words">
      {nodes.map((node, index) => {
        if (node.type === "text") {
          return <span key={index}>{node.text}</span>;
        }
        if (node.external) {
          return (
            <a
              key={index}
              href={node.href}
              target="_blank"
              rel="noopener noreferrer"
              className={LINK_CLASS}
            >
              {node.label}
            </a>
          );
        }
        return (
          <Link key={index} href={node.href} className={LINK_CLASS}>
            {node.label}
          </Link>
        );
      })}
      {showCursor ? (
        <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-accent align-baseline" />
      ) : null}
    </p>
  );
}
