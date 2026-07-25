import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { SimulateLayoutProfile } from "@widget-gen/shared";
import { ensureDevKitAnnotations } from "@widget-gen/shared";
import { loadSimulateLayoutProfile } from "./knowledge.ts";
import { getWidgetLuaPathForKey } from "./paths.ts";

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

/** Filesystem adapter for generated widget sources (UUID instance or legacy name). */
export class WidgetWorkspace {
  exists(workspaceKey: string): boolean {
    try {
      return existsSync(getWidgetLuaPathForKey(workspaceKey));
    } catch {
      return false;
    }
  }

  readSource(workspaceKey: string): ReadWidgetResult {
    let path: string;
    try {
      path = getWidgetLuaPathForKey(workspaceKey);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, message: msg };
    }

    if (!existsSync(path)) {
      return { ok: false, message: `Widget source not found: ${workspaceKey}` };
    }

    return { ok: true, source: readFileSync(path, "utf-8"), mutated: false };
  }

  prepareSource(
    workspaceKey: string,
    simulateProfile: SimulateLayoutProfile,
  ): ReadWidgetResult {
    const read = this.readSource(workspaceKey);
    if (!read.ok) return read;

    const annotated = ensureDevKitAnnotations(read.source, simulateProfile);
    if (annotated === read.source) {
      return { ok: true, source: read.source, mutated: false };
    }

    const path = getWidgetLuaPathForKey(workspaceKey);
    writeFileSync(path, annotated, "utf-8");
    return { ok: true, source: annotated, mutated: true };
  }

  prepareForRadio(workspaceKey: string, radioId: string): ReadWidgetResult {
    const profile = loadSimulateLayoutProfile(radioId);
    return this.prepareSource(workspaceKey, profile);
  }

  writeSource(workspaceKey: string, source: string): ReadWidgetResult {
    let path: string;
    try {
      path = getWidgetLuaPathForKey(workspaceKey);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, message: msg };
    }

    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, source, "utf-8");
    return { ok: true, source, mutated: true };
  }
}

export const defaultWorkspace = new WidgetWorkspace();
