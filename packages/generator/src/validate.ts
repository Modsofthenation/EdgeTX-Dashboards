import type { SimulateLayoutProfile, ValidationIssue, ValidationResult } from "@widget-gen/shared";
import {
  analyzeDrawSurface,
  extractRefreshBody,
  findRefreshBodyEndIndex,
} from "@widget-gen/shared";
import {
  validateDrawGeometry,
  DEFAULT_LAYOUT_SCENARIO,
  TORTURE_SCENARIOS,
} from "@widget-gen/layout-verify";
import { validateDevKitAnnotations, validateStubApiCalls } from "./devKit.js";
import { validateLcdApiUsage } from "./lcdApiValidate.js";
import type { LayoutArchetypeId } from "./layoutArchetype.js";
import { getActiveLayoutArchetype } from "./variationContext.js";

export interface ValidateWidgetOptions {
  maxOptions?: number;
  knownSensors?: string[];
  /** Unknown telemetry sensor names fail as errors (required before download). */
  strictTelemetry?: boolean;
  /** When set, validates ---@type / ---@simulate and stub-aware lcd.* calls. */
  simulateProfile?: SimulateLayoutProfile;
  /** When true, missing dev-kit annotations are errors (default before download). */
  strictDevKit?: boolean;
  /** Layout archetype for archetype-scoped visual warnings. */
  layoutArchetype?: LayoutArchetypeId;
}

const FORBIDDEN_PATTERNS = [
  { pattern: /\brequire\s*\(/, message: "require() is not allowed in EdgeTX widgets" },
  { pattern: /\bdofile\s*\(/, message: "dofile() is not allowed in EdgeTX widgets" },
  { pattern: /\bloadfile\s*\(/, message: "loadfile() is not allowed in EdgeTX widgets" },
  { pattern: /\bloadstring\s*\(/, message: "loadstring() is not allowed in EdgeTX widgets" },
  { pattern: /\bluarocks\b/i, message: "luarocks is not available on EdgeTX widgets" },
  { pattern: /\bio\./, message: "io.* is not allowed in EdgeTX widgets" },
  { pattern: /\bos\.execute\b/, message: "os.execute is not allowed in EdgeTX widgets" },
];

const OPTION_PATTERN = /\{\s*"([^"]+)"\s*,\s*(SOURCE|BOOL|VALUE|COLOR|STRING)/g;

/** Collect telemetry sensor names referenced in widget source. */
export function extractUsedTelemetrySensors(source: string): Set<string> {
  const used = new Set<string>();
  for (const pattern of [
    /cacheSource\s*\(\s*"([^"]+)"\s*\)/g,
    /getSourceIndex\s*\(\s*"([^"]+)"\s*\)/g,
    /getValue\s*\(\s*"([^"]+)"\s*\)/g,
  ]) {
    for (const match of source.matchAll(pattern)) {
      used.add(match[1]);
    }
  }
  return used;
}

function validateLcdOnlyInRefresh(source: string, issues: ValidationIssue[]): void {
  const body = extractRefreshBody(source);
  if (!body || body.length < 8) return;

  const sig = source.match(
    /(?:local\s+function\s+refresh\s*\([^)]*\)|refresh\s*=\s*function\s*\([^)]*\))/
  );
  if (!sig || sig.index === undefined) return;
  const bodyStart = sig.index + sig[0].length;
  const bodyEnd = findRefreshBodyEndIndex(source);

  const drawCall = /\blcd\.draw\w*\s*\(/g;
  for (const match of source.matchAll(drawCall)) {
    const idx = match.index ?? -1;
    if (idx < 0) continue;
    if (idx < bodyStart || idx >= bodyEnd) {
      issues.push({
        severity: "error",
        message:
          "lcd.draw* calls must be directly inside refresh() — web preview and the canvas editor require this",
      });
      return;
    }
  }
}

function validateLayoutGeometry(
  source: string,
  layoutArchetype?: LayoutArchetypeId
): ValidationIssue[] {
  if (!/lcd\.draw(Text|FilledRectangle|Annulus|FilledCircle)/.test(source)) {
    return [];
  }

  const hasAnnulus = source.includes("drawAnnulus");
  const strictArchetypes = new Set<LayoutArchetypeId>(["quad-overview", "hero-minimal"]);
  const strict = hasAnnulus || (layoutArchetype !== undefined && strictArchetypes.has(layoutArchetype));
  const scenarios = strict ? TORTURE_SCENARIOS : [DEFAULT_LAYOUT_SCENARIO];

  const issues: ValidationIssue[] = [];
  for (const scenario of scenarios) {
    const scenarioIssues = validateDrawGeometry(source, { scenario, strict });
    const errors = scenarioIssues.filter((i) => i.severity === "error");
    if (errors.length > 0) {
      for (const err of errors) {
        issues.push({
          ...err,
          message: `[scenario ${scenario.id}] ${err.message}`,
        });
      }
      return issues;
    }
    issues.push(...scenarioIssues.filter((i) => i.severity === "warning"));
  }

  return issues;
}

function validateVisualDesign(source: string, issues: ValidationIssue[], layoutArchetype?: LayoutArchetypeId): void {
  const {
    refreshBody,
    drawTextCount,
    hasFilledRectangle,
    filledRectangleCount,
    hasSmlSize,
    hasDblSize,
    stackedTopLeftWithoutPanels,
  } = analyzeDrawSurface(source);

  const archetype = layoutArchetype ?? getActiveLayoutArchetype();
  const cardLike = new Set<LayoutArchetypeId>(["card-grid", "heli-rotorflight", "quad-overview"]);
  const bandLike = new Set<LayoutArchetypeId>(["strip-board", "telemetry-dense"]);

  if (archetype === "hero-minimal") {
    if (!hasDblSize) {
      issues.push({
        severity: "warning",
        message: "Hero-minimal layout — use one DBLSIZE hero metric",
      });
    }
  } else if (bandLike.has(archetype ?? "card-grid")) {
    if (filledRectangleCount < 2) {
      issues.push({
        severity: "warning",
        message:
          "Strip/dense layout — use at least 2 horizontal or vertical bands (drawFilledRectangle dividers or column backgrounds)",
      });
    }
  } else if (!archetype || cardLike.has(archetype) || archetype === "flight-logger-suite" || archetype === "battery-tool-suite") {
    if (!hasFilledRectangle) {
      issues.push({
        severity: "warning",
        message:
          "No grouped regions — use lcd.drawFilledRectangle + lcd.drawRectangle for metric panels or bands",
      });
    }
  }

  if (drawTextCount > 22) {
    issues.push({
      severity: "warning",
      message: `High text density (${drawTextCount} drawText calls) — simplify layout or use BOOL options to hide sections`,
    });
  }

  if (drawTextCount > 0 && !hasSmlSize) {
    issues.push({
      severity: "warning",
      message: "No SMLSIZE labels — use label/value hierarchy (SMLSIZE labels, MIDSIZE/DBLSIZE values)",
    });
  }

  if (stackedTopLeftWithoutPanels) {
    issues.push({
      severity: "warning",
      message:
        "Stacked top-left text without structure — use grid alignment and grouped regions per archetype",
    });
  }

  if (/lcd\.drawText\s*\([^)]*\b(?:fmtNum|telem)\s*\(/.test(refreshBody)) {
    issues.push({
      severity: "warning",
      message:
        "Format telemetry into locals before drawText — inline fmtNum/telem in lcd.drawText breaks web preview",
    });
  }
}

function validateReturnTable(source: string, issues: ValidationIssue[]): void {
  const lastReturn = source.lastIndexOf("return {");
  if (lastReturn === -1) {
    issues.push({ severity: "error", message: "Missing return { ... } widget table" });
    return;
  }

  const tail = source.slice(lastReturn);
  const blockMatch = tail.match(/return\s*\{([\s\S]*)\n\}/);
  const block = blockMatch?.[1] ?? "";

  if (!/\bname\b/.test(block)) {
    issues.push({ severity: "error", message: "Return table must include name field" });
  }
  if (!/\bcreate\b/.test(block)) {
    issues.push({ severity: "error", message: "Return table must include create function" });
  }
  if (!/\brefresh\b/.test(block)) {
    issues.push({ severity: "error", message: "Return table must include refresh function" });
  }
}

function validateFunctions(source: string, issues: ValidationIssue[]): void {
  const hasCreate =
    /\bcreate\s*=\s*function\b/.test(source) || /function\s+create\s*\(/.test(source);
  const hasRefresh =
    /\brefresh\s*=\s*function\b/.test(source) || /function\s+refresh\s*\(/.test(source);

  if (!hasCreate) {
    issues.push({ severity: "error", message: "Missing create function" });
  }
  if (!hasRefresh) {
    issues.push({ severity: "error", message: "Missing refresh function" });
  }
}

function validateWidgetName(source: string, issues: ValidationIssue[]): string | undefined {
  const nameMatch =
    source.match(/local\s+name\s*=\s*"([^"]+)"/) ??
    source.match(/(?:^|\n)\s*name\s*=\s*"([^"]+)"/);

  if (!nameMatch) {
    issues.push({ severity: "error", message: "Could not find widget name declaration" });
    return undefined;
  }

  const widgetName = nameMatch[1];
  if (widgetName.length > 10) {
    issues.push({
      severity: "error",
      message: `Widget name "${widgetName}" exceeds 10 characters`,
    });
  }
  if (/\s/.test(widgetName)) {
    issues.push({ severity: "error", message: "Widget name must not contain spaces" });
  }
  if (!/^[A-Za-z0-9_]+$/.test(widgetName)) {
    issues.push({
      severity: "error",
      message: `Widget name "${widgetName}" must be alphanumeric/underscore only`,
    });
  }

  return widgetName;
}

function validateOptions(
  source: string,
  maxOptions: number,
  issues: ValidationIssue[]
): void {
  let optionCount = 0;
  for (const match of source.matchAll(OPTION_PATTERN)) {
    optionCount++;
    const optName = match[1];
    if (optName.length > 10) {
      issues.push({
        severity: "error",
        message: `Option name "${optName}" exceeds 10 characters`,
      });
    }
    if (/\s/.test(optName)) {
      issues.push({ severity: "error", message: `Option name "${optName}" contains spaces` });
    }
  }

  if (optionCount > maxOptions) {
    issues.push({
      severity: "error",
      message: `Too many options (${optionCount}); max is ${maxOptions}`,
    });
  }
}

function validateTelemetry(
  source: string,
  knownSensors: string[],
  strictTelemetry: boolean,
  issues: ValidationIssue[]
): void {
  const used = extractUsedTelemetrySensors(source);
  for (const sensor of used) {
    if (!knownSensors.includes(sensor)) {
      issues.push({
        severity: strictTelemetry ? "error" : "warning",
        message: `Sensor "${sensor}" not found in selected protocol catalog`,
      });
    }
  }
}

/**
 * Static + constraint validation for EdgeTX Lua widget source.
 * Use strictTelemetry: true before packaging/download.
 */
export function validateWidgetLua(
  source: string,
  options?: ValidateWidgetOptions
): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!source.trim()) {
    return { valid: false, issues: [{ severity: "error", message: "Empty source file" }] };
  }

  for (const { pattern, message } of FORBIDDEN_PATTERNS) {
    if (pattern.test(source)) {
      issues.push({ severity: "error", message });
    }
  }

  validateReturnTable(source, issues);
  validateFunctions(source, issues);
  validateLcdOnlyInRefresh(source, issues);
  const widgetName = validateWidgetName(source, issues);
  validateOptions(source, options?.maxOptions ?? 10, issues);

  if (!source.includes("getSourceIndex") && !source.includes("cacheSource")) {
    issues.push({
      severity: "warning",
      message: "Consider caching telemetry with getSourceIndex() in create()",
    });
  }

  validateVisualDesign(source, issues, options?.layoutArchetype);

  if (options?.knownSensors?.length) {
    validateTelemetry(source, options.knownSensors, options.strictTelemetry ?? false, issues);
  }

  if (options?.simulateProfile) {
    for (const issue of validateDevKitAnnotations(source, options.simulateProfile)) {
      if (options.strictDevKit && issue.severity === "warning") {
        issues.push({ ...issue, severity: "error" });
      } else {
        issues.push(issue);
      }
    }
    issues.push(...validateStubApiCalls(source, { strict: options.strictDevKit === true }));
  }

  issues.push(...validateLcdApiUsage(source));
  issues.push(...validateLayoutGeometry(source, options?.layoutArchetype));

  const errors = issues.filter((i) => i.severity === "error");
  return { valid: errors.length === 0, widgetName, issues };
}
