import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ValidationIssue } from "@widget-gen/shared";
import {
  type SimulateLayoutProfile,
  type PreviewDimensions,
  type SimulateAnnotation,
  type WidgetZoneRect,
  parseScriptTypeAnnotation,
  parseSimulateAnnotation,
  resolveSimulateZone,
  resolvePreviewDimensions,
  ensureDevKitAnnotations,
  getSimulateLayoutProfile,
} from "@widget-gen/shared";
import { getRepoRoot } from "./knowledge.js";

export type {
  SimulateLayoutProfile,
  PreviewDimensions,
  SimulateAnnotation,
  WidgetZoneRect,
};

export {
  parseScriptTypeAnnotation,
  parseSimulateAnnotation,
  resolveSimulateZone,
  resolvePreviewDimensions,
  ensureDevKitAnnotations,
  getSimulateLayoutProfile,
};

let cachedApiIndex: Map<string, Set<string>> | null | undefined;

function loadStubApiIndex(): Map<string, Set<string>> | null {
  if (cachedApiIndex !== undefined) return cachedApiIndex;

  const apiPath = join(getRepoRoot(), "stubs", "2.11", "edgetx-lua-api.json");
  if (!existsSync(apiPath)) {
    cachedApiIndex = null;
    return null;
  }

  const data = JSON.parse(readFileSync(apiPath, "utf-8")) as {
    functions?: Array<{ module?: string; name?: string }>;
    [section: string]: unknown;
  };

  const index = new Map<string, Set<string>>();

  const addFunctions = (functions: Array<{ module?: string; name?: string }> | undefined) => {
    for (const fn of functions ?? []) {
      if (!fn.module || !fn.name) continue;
      const mod = fn.module.toLowerCase();
      if (!index.has(mod)) index.set(mod, new Set());
      index.get(mod)!.add(fn.name);
    }
  };

  addFunctions(data.functions);

  for (const [key, section] of Object.entries(data)) {
    if (key === "functions" || key === "version" || key === "generated") continue;
    if (section && typeof section === "object" && "functions" in section) {
      addFunctions((section as { functions?: Array<{ module?: string; name?: string }> }).functions);
    }
  }

  cachedApiIndex = index;
  return index;
}

export function resetStubApiCache(): void {
  cachedApiIndex = undefined;
}

const STUB_CHECK_MODULES = ["lcd", "model", "bitmap", "lvgl"] as const;

export function validateStubApiCalls(source: string): ValidationIssue[] {
  const index = loadStubApiIndex();
  if (!index) {
    return [
      {
        severity: "warning",
        message:
          "EdgeTX stubs not found — run npm run sync-stubs for stub-aware API checks",
      },
    ];
  }

  const issues: ValidationIssue[] = [];
  const pattern = /\b(lcd|model|bitmap|lvgl)\.(\w+)\s*\(/g;

  for (const match of source.matchAll(pattern)) {
    const mod = match[1];
    const method = match[2];
    if (!STUB_CHECK_MODULES.includes(mod as (typeof STUB_CHECK_MODULES)[number])) continue;

    const methods = index.get(mod);
    if (!methods?.has(method)) {
      issues.push({
        severity: "error",
        message: `Unknown EdgeTX API ${mod}.${method}() for EdgeTX 2.11 stubs`,
      });
    }
  }

  return issues;
}

export function validateDevKitAnnotations(
  source: string,
  profile: SimulateLayoutProfile
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const scriptType = parseScriptTypeAnnotation(source);
  if (!scriptType) {
    issues.push({
      severity: "warning",
      message: "Missing ---@type WidgetScript annotation (required for EdgeTX Dev Kit)",
    });
  } else if (scriptType !== "WidgetScript") {
    issues.push({
      severity: "error",
      message: `Expected ---@type WidgetScript, found ${scriptType}`,
    });
  }

  const simulate = parseSimulateAnnotation(source);
  if (!simulate) {
    issues.push({
      severity: "warning",
      message: "Missing ---@simulate annotation (recommended for dev-kit simulation)",
    });
  } else if (!profile.layouts[simulate.layout]) {
    issues.push({
      severity: "error",
      message: `Unknown simulate layout "${simulate.layout}" for ${profile.radioId}`,
    });
  } else {
    const zones = profile.layouts[simulate.layout].zones;
    if (simulate.zone < 0 || simulate.zone >= zones.length) {
      issues.push({
        severity: "error",
        message: `Simulate zone ${simulate.zone} out of range for ${simulate.layout} (0-${zones.length - 1})`,
      });
    }
  }

  return issues;
}
