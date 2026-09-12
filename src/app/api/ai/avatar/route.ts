import { NextResponse } from "next/server";
import { fetchDifyFilePreview, fetchDifyIconUrl, fetchImageBytes } from "@/lib/ai/dify";
import { getAiUiConfig } from "@/lib/ai/ui-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const OK_HEADERS = {
  "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
} as const;

/**
 * Same-origin passthrough for Nora's Dify avatar.
 *
 * Dify signs its app-icon URL with an expiry, so the URL inside a cached
 * configuration is often already rejected by the browser with
 * `404 "File not found or signature is invalid"` — which is exactly why the
 * icon used to disappear. This route therefore re-reads the icon server-side,
 * minting a fresh URL, and streams the bytes back:
 *
 *   1. a freshly signed URL from Dify (`GET /site`, cache bypassed),
 *   2. the URL the current configuration holds,
 *   3. the authenticated file API (`GET /files/{file_id}/preview`).
 *
 * It takes no parameters — it can only ever return the icon of the app this
 * deployment is configured for — and `DIFY_API_KEY` never reaches the browser.
 */
export async function GET() {
  const config = await getAiUiConfig();

  if (config.avatarType !== "image") {
    return new NextResponse(null, { status: 404 });
  }

  const freshUrl = await fetchDifyIconUrl();
  if (freshUrl) {
    const fresh = await fetchImageBytes(freshUrl);
    if (fresh) {
      return new NextResponse(fresh.bytes, {
        status: 200,
        headers: { "Content-Type": fresh.contentType, ...OK_HEADERS },
      });
    }
  }

  if (config.avatarUrl) {
    const cached = await fetchImageBytes(config.avatarUrl);
    if (cached) {
      return new NextResponse(cached.bytes, {
        status: 200,
        headers: { "Content-Type": cached.contentType, ...OK_HEADERS },
      });
    }
  }

  if (config.avatarFileId) {
    const file = await fetchDifyFilePreview(config.avatarFileId);
    if (file) {
      return new NextResponse(file.bytes, {
        status: 200,
        headers: { "Content-Type": file.contentType, ...OK_HEADERS },
      });
    }
  }

  return new NextResponse(null, { status: 404 });
}
