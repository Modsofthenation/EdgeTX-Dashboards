import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lightweight readiness probe for the Tauri desktop sidecar. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "edgetx-dashboards",
    ts: new Date().toISOString(),
  });
}
