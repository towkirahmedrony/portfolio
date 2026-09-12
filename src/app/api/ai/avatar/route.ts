import { NextResponse } from "next/server";
import { fetchDifyFilePreview } from "@/lib/ai/dify";
import { getAiUiConfig } from "@/lib/ai/ui-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * Same-origin passthrough for Nora's Dify avatar.
 *
 * Dify's app icon is served from a signed cloud URL that browsers reject with
 * `404 "File not found or signature is invalid"`, so the UI falls back to this
 * route, which re-reads the same icon server-side with `DIFY_API_KEY`
 * (`GET {DIFY_API_URL}/files/{file_id}/preview`). The key never reaches the
 * browser and the route takes no parameters — it can only ever return the icon
 * of the app this deployment is configured for — so it cannot be abused as a
 * file proxy.
 */
export async function GET() {
  const config = await getAiUiConfig();

  if (config.avatarType !== "image" || !config.avatarFileId) {
    return new NextResponse(null, { status: 404 });
  }

  const file = await fetchDifyFilePreview(config.avatarFileId);
  if (!file) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(file.bytes, {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.bytes.byteLength),
      "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
    },
  });
}
