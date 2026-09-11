import { NextResponse } from "next/server";

/**
 * Retired. The website now uses Dify's official embedded chatbot, so this
 * custom chat bridge is unused. `/api/ai/context` remains the live-data
 * endpoint for the Dify Chatflow.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
}

export function POST() {
  return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
}
