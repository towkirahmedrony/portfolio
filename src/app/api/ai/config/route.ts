import { NextResponse } from "next/server";

/**
 * Retired. Dify's embedded chatbot owns assistant name, avatar, opening
 * message, and suggested questions. This site no longer fetches those
 * settings.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
}
