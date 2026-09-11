import { NextResponse } from "next/server";
import { AI_UI_CONFIG_REVALIDATE_SECONDS, getAiUiConfig } from "@/lib/ai/ui-config";
import type { AiUiConfigResponse } from "@/types/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET() {
  const config = await getAiUiConfig();
  const body: AiUiConfigResponse = { ok: true, ...config };
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": `public, s-maxage=${AI_UI_CONFIG_REVALIDATE_SECONDS}, stale-while-revalidate=60`,
    },
  });
}
