"use client";

import { useState } from "react";
import { AssistantIcon } from "@/components/ai/assistant-icon";
import type { AiUiConfig } from "@/types/ai";

type AvatarConfig = Pick<
  AiUiConfig,
  "avatarUrl" | "avatarProxyUrl" | "avatarEmoji" | "avatarType"
>;

/**
 * Nora's avatar, shared by the floating launcher and the chat page so both show
 * exactly the same Dify-provided picture.
 *
 * Dify's own URL is tried first (used exactly as Dify returned it), then the
 * same-origin `/api/ai/avatar` passthrough, then Dify's emoji icon, and finally
 * the local mark — so an unreachable icon can never leave a broken image or an
 * empty circle. The fallback layer sits *under* the image, so nothing flashes
 * while the remote image is still loading.
 *
 * A plain `<img>` is used on purpose: the avatar is an external Dify URL, which
 * would otherwise require adding remote patterns to the global Next.js image
 * configuration.
 */
export function AssistantAvatar({
  config,
  size = 40,
  className,
}: {
  config: AvatarConfig;
  size?: number;
  className?: string;
}) {
  const [stage, setStage] = useState(0);
  const sources = [config.avatarUrl, config.avatarProxyUrl].filter(
    (source): source is string => Boolean(source),
  );
  const src = config.avatarType === "image" ? (sources[stage] ?? null) : null;

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
      <span className="absolute inset-0 flex items-center justify-center">
        {config.avatarEmoji ? (
          <span className="leading-none" style={{ fontSize: Math.round(size * 0.5) }} aria-hidden>
            {config.avatarEmoji}
          </span>
        ) : (
          <AssistantIcon className="h-[55%] w-[55%]" />
        )}
      </span>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- external Dify avatar URL
        <img
          src={src}
          alt=""
          className="relative h-full w-full object-cover"
          onError={() => setStage((current) => current + 1)}
        />
      ) : null}
    </span>
  );
}
