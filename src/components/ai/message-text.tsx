"use client";

import Link from "next/link";
import { parseMessageContent } from "@/lib/ai/links";
import { stripInternalReasoning } from "@/lib/ai/response-text";

/**
 * Existing theme tokens only, so the chat keeps the site's visual identity.
 */
const LINK_CLASS =
  "rounded-sm font-medium text-accent underline decoration-accent/40 underline-offset-2 transition-colors hover:decoration-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

const BULLET_LINE = /^\s*[-*•]\s+(.*)$/;
const NUMBERED_LINE = /^\s*\d{1,3}[.)]\s+(.*)$/;

type Block =
  | { kind: "paragraph"; lines: string[] }
  | { kind: "bullets"; items: string[] }
  | { kind: "numbers"; items: string[] };

/**
 * Splits a reply into paragraphs and (bullet / numbered) lists. Deliberately
 * minimal — no markdown dependency: Dify returns prose with the occasional
 * list, so that is all this understands.
 */
function toBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  // Defensive second half of the guarantee: the server already strips internal
  // reasoning, but rendering normalises again so older stored rows, cached
  // payloads, or anything else that slipped through can never be displayed.
  const lines = stripInternalReasoning(content).replace(/\r\n?/g, "\n").split("\n");
  let paragraph: string[] = [];
  let list: Block | null = null;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: "paragraph", lines: paragraph });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push(list);
      list = null;
    }
  };

  for (const line of lines) {
    const bullet = BULLET_LINE.exec(line);
    if (bullet) {
      flushParagraph();
      if (!list || list.kind !== "bullets") {
        flushList();
        list = { kind: "bullets", items: [] };
      }
      (list as { items: string[] }).items.push(bullet[1]);
      continue;
    }

    const numbered = NUMBERED_LINE.exec(line);
    if (numbered) {
      flushParagraph();
      if (!list || list.kind !== "numbers") {
        flushList();
        list = { kind: "numbers", items: [] };
      }
      (list as { items: string[] }).items.push(numbered[1]);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}

/**
 * Text with safe links: internal destinations use next/link, external http(s)
 * URLs open in a new tab, and anything unsafe (javascript:, data:, ...) stays
 * plain text. `parseMessageContent` is the existing link resolver.
 */
function Inline({ text }: { text: string }) {
  const nodes = parseMessageContent(text);

  return (
    <>
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
    </>
  );
}

export function MessageText({
  content,
  showCursor = false,
}: {
  content: string;
  showCursor?: boolean;
}) {
  const blocks = toBlocks(content);

  return (
    <div className="flex flex-col gap-2 break-words">
      {blocks.map((block, index) => {
        if (block.kind === "bullets") {
          return (
            <ul key={index} className="ml-1 list-disc space-y-1 pl-4">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <Inline text={item} />
                </li>
              ))}
            </ul>
          );
        }

        if (block.kind === "numbers") {
          return (
            <ol key={index} className="ml-1 list-decimal space-y-1 pl-4">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <Inline text={item} />
                </li>
              ))}
            </ol>
          );
        }

        return (
          <p key={index} className="whitespace-pre-wrap">
            {block.lines.map((line, lineIndex) => (
              <span key={lineIndex}>
                {lineIndex > 0 ? <br /> : null}
                <Inline text={line} />
              </span>
            ))}
          </p>
        );
      })}
      {showCursor ? (
        <span
          className="inline-block h-3 w-1.5 animate-pulse bg-accent align-baseline"
          aria-hidden
        />
      ) : null}
    </div>
  );
}
