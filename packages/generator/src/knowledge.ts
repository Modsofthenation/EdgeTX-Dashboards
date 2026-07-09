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

const textFileCache = new Map<string, string>();
const radioCache = new Map<string, RadioProfile>();
const catalogCache = new Map<TelemetryProtocol, TelemetryCatalog>();

function readCachedText(path: string): string {
  const hit = textFileCache.get(path);
  if (hit !== undefined) return hit;
  const text = readFileSync(path, "utf-8");
  textFileCache.set(path, text);
  return text;
}

function readCachedTextIfExists(path: string): string {
  if (!existsSync(path)) return "";
  return readCachedText(path);
}

export function loadRadioProfile(radioId: string): RadioProfile {
  const cached = radioCache.get(radioId);
  if (cached) return cached;
  const path = join(getRepoRoot(), "knowledge", "radios", `${radioId}.json`);
  if (!existsSync(path)) {
    throw new Error(`Radio profile not found: ${radioId}`);
  }
  const profile = JSON.parse(readCachedText(path)) as RadioProfile;
  radioCache.set(radioId, profile);
  return profile;
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
  const cached = catalogCache.get(protocol);
  if (cached) return cached;
  const filename = PROTOCOL_FILES[protocol];
  const path = join(getRepoRoot(), "knowledge", "telemetry", filename);
  if (!existsSync(path)) {
    throw new Error(`Telemetry catalog not found: ${protocol}`);
  }
  const catalog = JSON.parse(readCachedText(path)) as TelemetryCatalog;
  catalogCache.set(protocol, catalog);
  return catalog;
}

export function readTemplate(name: string): string {
  const path = join(getRepoRoot(), "templates", name);
  return readCachedText(path);
}

export function readRules(): string {
  const path = join(getRepoRoot(), ".cursor", "rules", "edgetx-lua.md");
  return readCachedText(path);
}

export function readLayoutPrinciples(): string {
  const path = join(getRepoRoot(), "knowledge", "design", "layout-principles.md");
  return readCachedTextIfExists(path);
}

export function readCardGridRecipe(): string {
  const path = join(getRepoRoot(), "knowledge", "design", "tx15-card-grid-recipe.md");
  return readCachedTextIfExists(path);
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
  const lines = readCachedText(path).split(/\r?\n/);
  return lines.slice(0, maxLines).join("\n");
}

/** Layout-heavy examples need the reserved-rect planner in refresh(), not just create(). */
const LAYOUT_HEAVY_EXAMPLES = new Set([
  "tx15-bfdash8f-whoop-dashboard.lua",
  "tx15-model-hero-dashboard.lua",
]);

export function readLayoutExampleSnippet(exampleFile: string, maxLines = 140): string {
  return readExampleSnippet(exampleFile, maxLines);
}

export function readExampleSnippetForArchetype(exampleFile: string): string {
  if (LAYOUT_HEAVY_EXAMPLES.has(exampleFile)) {
    return readLayoutExampleSnippet(exampleFile);
  }
  return readExampleSnippet(exampleFile);
}

export function readLayoutReservedRectsGuide(): string {
  return readCachedTextIfExists(join(getRepoRoot(), "knowledge", "design", "layout-reserved-rects.md"));
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
    const text = readCachedTextIfExists(path);
    if (text) return text;
  }

  return "";
}

export function readRotorflightStyleGuide(): string {
  return readCachedTextIfExists(join(getRepoRoot(), "knowledge", "design", "rotorflight-dbk-patterns.md"));
}

export function readCompanionScriptsGuide(): string {
  return readCachedTextIfExists(join(getRepoRoot(), "knowledge", "design", "companion-scripts.md"));
}

export function readModelImageGuide(): string {
  return readCachedTextIfExists(join(getRepoRoot(), "knowledge", "design", "model-image.md"));
}

export function readModelHeroDashboardGuide(): string {
  return readCachedTextIfExists(join(getRepoRoot(), "knowledge", "design", "model-hero-dashboard.md"));
}

export function readTextLayoutGuide(): string {
  return readCachedTextIfExists(join(getRepoRoot(), "knowledge", "design", "tx15-text-layout.md"));
}

export function readRuntimeApiPitfallsGuide(): string {
  return readCachedTextIfExists(join(getRepoRoot(), "knowledge", "design", "runtime-api-pitfalls.md"));
}

export function readThemePalettesGuide(): string {
  return readCachedTextIfExists(join(getRepoRoot(), "knowledge", "design", "edgetx-theme-palettes.md"));
}

export function readRoundedCornersGuide(): string {
  return readCachedTextIfExists(join(getRepoRoot(), "knowledge", "design", "rounded-card-panels.md"));
}

export function loadSimulateLayoutProfile(radioId: string): SimulateLayoutProfile {
  return getSimulateLayoutProfile(getLayoutProfileId(loadRadioProfile(radioId)));
}
