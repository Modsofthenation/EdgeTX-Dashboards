import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { isLoopbackRequest } from "~/lib/apiSecurity";
import { getRepoRoot, isCursorSandboxEnabled } from "~/server/generatorFacade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lightweight readiness probe for the Tauri desktop sidecar. */
export async function GET(request: Request) {
  // Public hosts only get a coarse ok — avoid leaking node/sandbox/layout details.
  if (!isLoopbackRequest(request)) {
    return NextResponse.json({ ok: true, service: "edgetx-dashboards" });
  }

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
