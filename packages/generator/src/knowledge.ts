import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RadioProfile, TelemetryCatalog, TelemetryProtocol } from "@widget-gen/shared";

const __dirname = dirname(fileURLToPath(import.meta.url));

const REPO_MARKER = join("knowledge", "radios", "tx15.json");

function isRepoRoot(dir: string): boolean {
  return existsSync(join(dir, REPO_MARKER));
}

/** Resolve monorepo root (works from dist/ and when Next.js cwd is apps/web). */
export function getRepoRoot(): string {
  const envRoot = process.env.WIDGET_GEN_REPO_ROOT;
  if (envRoot) {
    const resolved = resolve(envRoot);
    if (isRepoRoot(resolved)) return resolved;
  }

  const searchRoots = [resolve(process.cwd()), resolve(__dirname)];
  for (const start of searchRoots) {
    let dir = start;
    for (let depth = 0; depth < 8; depth++) {
      if (isRepoRoot(dir)) return dir;
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }

  throw new Error(
    `Could not locate repository root (missing ${REPO_MARKER}). cwd=${process.cwd()}`
  );
}

export function loadRadioProfile(radioId: string): RadioProfile {
  const path = join(getRepoRoot(), "knowledge", "radios", `${radioId}.json`);
  if (!existsSync(path)) {
    throw new Error(`Radio profile not found: ${radioId}`);
  }
  return JSON.parse(readFileSync(path, "utf-8")) as RadioProfile;
}

const PROTOCOL_FILES: Record<TelemetryProtocol, string> = {
  betaflight: "betaflight-crsf.json",
  rotorflight: "rotorflight-crsf.json",
  "generic-crsf": "generic-crsf.json",
};

export function loadTelemetryCatalog(protocol: TelemetryProtocol): TelemetryCatalog {
  const filename = PROTOCOL_FILES[protocol];
  const path = join(getRepoRoot(), "knowledge", "telemetry", filename);
  if (!existsSync(path)) {
    throw new Error(`Telemetry catalog not found: ${protocol}`);
  }
  return JSON.parse(readFileSync(path, "utf-8")) as TelemetryCatalog;
}

export function readTemplate(name: string): string {
  const path = join(getRepoRoot(), "templates", name);
  return readFileSync(path, "utf-8");
}

export function readRules(): string {
  const path = join(getRepoRoot(), ".cursor", "rules", "edgetx-lua.md");
  return readFileSync(path, "utf-8");
}

export function readDesignGuide(radioId = "tx15"): string {
  const path = join(getRepoRoot(), "knowledge", "design", `${radioId}-dashboard-ui.md`);
  if (!existsSync(path)) {
    return "";
  }
  return readFileSync(path, "utf-8");
}

export { loadSimulateLayoutProfile, type SimulateLayoutProfile } from "./devKit.js";
