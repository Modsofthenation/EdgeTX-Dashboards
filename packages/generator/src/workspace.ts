import { readFileSync, existsSync, writeFileSync } from "node:fs";
import type { SimulateLayoutProfile } from "@widget-gen/shared";
import { ensureDevKitAnnotations, getSimulateLayoutProfile } from "@widget-gen/shared";
import { getWidgetLuaPath } from "./paths.js";

export interface WidgetSourceResult {
  ok: true;
  source: string;
  mutated: boolean;
}

export interface WidgetSourceError {
  ok: false;
  message: string;
}

export type ReadWidgetResult = WidgetSourceResult | WidgetSourceError;

/** Filesystem adapter for generated widget sources. */
export class WidgetWorkspace {
  exists(widgetName: string): boolean {
    try {
      return existsSync(getWidgetLuaPath(widgetName));
    } catch {
      return false;
    }
  }

  readSource(widgetName: string): ReadWidgetResult {
    let path: string;
    try {
      path = getWidgetLuaPath(widgetName);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, message: msg };
    }

    if (!existsSync(path)) {
      return { ok: false, message: `Widget source not found: ${widgetName}` };
    }

    return { ok: true, source: readFileSync(path, "utf-8"), mutated: false };
  }

  /**
   * Read widget source and ensure dev-kit annotations (single mutation path).
   * Writes to disk only when annotations change.
   */
  prepareSource(
    widgetName: string,
    simulateProfile: SimulateLayoutProfile
  ): ReadWidgetResult {
    const read = this.readSource(widgetName);
    if (!read.ok) return read;

    const annotated = ensureDevKitAnnotations(read.source, simulateProfile);
    if (annotated === read.source) {
      return { ok: true, source: read.source, mutated: false };
    }

    const path = getWidgetLuaPath(widgetName);
    writeFileSync(path, annotated, "utf-8");
    return { ok: true, source: annotated, mutated: true };
  }

  prepareForRadio(widgetName: string, radioId: string): ReadWidgetResult {
    const profile = getSimulateLayoutProfile(radioId);
    return this.prepareSource(widgetName, profile);
  }
}

export const defaultWorkspace = new WidgetWorkspace();
