import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { RadioProfile, TelemetryCatalog, TelemetryProtocol } from "@widget-gen/shared";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function getRepoRoot(): string {
  return join(__dirname, "..", "..", "..");
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
