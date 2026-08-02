import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getRepoRoot, isCursorSandboxEnabled } from "~/server/generatorFacade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lightweight readiness probe for the Tauri desktop sidecar. */
export async function GET() {
  let repoRootOk = false;
  try {
    const repoRoot = getRepoRoot();
    repoRootOk = existsSync(join(repoRoot, "knowledge", "radios", "tx15.json"));
  } catch {
    repoRootOk = false;
  }

  return NextResponse.json({
    ok: true,
    service: "edgetx-dashboards",
    ts: new Date().toISOString(),
    node: process.versions.node,
    desktopWorkspace: Boolean(process.env.WIDGET_GEN_REPO_ROOT?.trim()),
    sandboxEnabled: isCursorSandboxEnabled(),
    repoRootOk,
  });
}
