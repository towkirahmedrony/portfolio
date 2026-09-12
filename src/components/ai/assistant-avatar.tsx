"use client";

import { useState } from "react";
import { AssistantIcon } from "@/components/ai/assistant-icon";

/**
 * Nora's profile picture.
 *
 * Served from our own `public/` directory: the file is part of the page, so it
 * paints with the first render — no Dify request, no `/api/ai/config` round
 * trip, and therefore no generic bot icon flashing before the real photo.
 *
 * A plain `<img>` is used deliberately: it needs no image-optimiser round trip,
 * which is what keeps the first paint immediate. Everything else about Nora
 * (name, opening message, suggested questions, placeholder) still comes from
 * Dify through `/api/ai/config`.
 */
export const NORA_AVATAR_SRC = "/images/nora.webp";

export function AssistantAvatar({
  size = 40,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <span
      className={[
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-soft text-accent",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ width: size, height: size }}
    >
      {failed ? (
        // Only reachable if the asset itself cannot be read (e.g. it was
        // replaced with a broken file): never shown while the photo loads.
        <AssistantIcon className="h-[55%] w-[55%]" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- local static asset, no optimiser round trip
        <img
          src={NORA_AVATAR_SRC}
          alt=""
          width={size}
          height={size}
          draggable={false}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
