import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RadioProfile, TelemetryCatalog, TelemetryProtocol, SimulateLayoutProfile } from "@widget-gen/shared";
import { DEFAULT_RADIO_ID, getSimulateLayoutProfile } from "@widget-gen/shared";

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

/** Layout profile key used for simulate zones and preview (defaults to radio id). */
export function getLayoutProfileId(radio: RadioProfile): string {
  return radio.layoutProfile ?? radio.id;
}

export function getLayoutProfileIdForRadio(radioId: string): string {
  return getLayoutProfileId(loadRadioProfile(radioId));
}

/** All supported radio profiles from knowledge/radios/*.json (sorted by name). */
export function listRadioProfiles(): RadioProfile[] {
  const dir = join(getRepoRoot(), "knowledge", "radios");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json") && !f.startsWith("_"));

  return files
    .map((file) => loadRadioProfile(file.replace(/\.json$/, "")))
    .sort((a, b) => {
      if (a.id === DEFAULT_RADIO_ID) return -1;
      if (b.id === DEFAULT_RADIO_ID) return 1;
      return a.name.localeCompare(b.name);
    });
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

export function readLayoutPrinciples(): string {
  const path = join(getRepoRoot(), "knowledge", "design", "layout-principles.md");
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf-8");
}

export function readCardGridRecipe(): string {
  const path = join(getRepoRoot(), "knowledge", "design", "tx15-card-grid-recipe.md");
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf-8");
}

export function readDesignGuideForArchetype(
  radioId = DEFAULT_RADIO_ID,
  archetypeId?: string
): string {
  const principles = readLayoutPrinciples();
  const cardArchetypes = new Set(["card-grid", "heli-rotorflight"]);
  if (archetypeId && cardArchetypes.has(archetypeId)) {
    const recipe = readCardGridRecipe();
    return [principles, recipe].filter(Boolean).join("\n\n");
  }

  if (principles) return principles;

  return readDesignGuide(radioId);
}

export function readExampleSnippet(exampleFile: string, maxLines = 55): string {
  const path = join(getRepoRoot(), "examples", exampleFile);
  if (!existsSync(path)) return "";
  const lines = readFileSync(path, "utf-8").split(/\r?\n/);
  return lines.slice(0, maxLines).join("\n");
}

export function readDesignGuide(radioId = DEFAULT_RADIO_ID): string {
  const radio = loadRadioProfile(radioId);
  const layoutKey = getLayoutProfileId(radio);
  const candidates = [
    join(getRepoRoot(), "knowledge", "design", `${radioId}-dashboard-ui.md`),
    join(getRepoRoot(), "knowledge", "design", `${layoutKey}-dashboard-ui.md`),
    join(getRepoRoot(), "knowledge", "design", "tx15-dashboard-ui.md"),
  ];

  for (const path of candidates) {
    if (existsSync(path)) {
      return readFileSync(path, "utf-8");
    }
  }

  return "";
}

export function readRotorflightStyleGuide(): string {
  const path = join(getRepoRoot(), "knowledge", "design", "rotorflight-dbk-patterns.md");
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf-8");
}

export function readCompanionScriptsGuide(): string {
  const path = join(getRepoRoot(), "knowledge", "design", "companion-scripts.md");
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf-8");
}

export function readModelImageGuide(): string {
  const path = join(getRepoRoot(), "knowledge", "design", "model-image.md");
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf-8");
}

export function readModelHeroDashboardGuide(): string {
  const path = join(getRepoRoot(), "knowledge", "design", "model-hero-dashboard.md");
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf-8");
}

export function readTextLayoutGuide(): string {
  const path = join(getRepoRoot(), "knowledge", "design", "tx15-text-layout.md");
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf-8");
}

export function readRuntimeApiPitfallsGuide(): string {
  const path = join(getRepoRoot(), "knowledge", "design", "runtime-api-pitfalls.md");
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf-8");
}

export function readThemePalettesGuide(): string {
  const path = join(getRepoRoot(), "knowledge", "design", "edgetx-theme-palettes.md");
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf-8");
}

export function readRoundedCornersGuide(): string {
  const path = join(getRepoRoot(), "knowledge", "design", "rounded-card-panels.md");
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf-8");
}

export function loadSimulateLayoutProfile(radioId: string): SimulateLayoutProfile {
  return getSimulateLayoutProfile(getLayoutProfileId(loadRadioProfile(radioId)));
}
