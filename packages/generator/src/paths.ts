import { join, resolve, relative, sep } from "node:path";
import { getRepoRoot } from "./knowledge.js";

/** EdgeTX widget names: max 10 chars, alphanumeric + underscore only. */
export const WIDGET_NAME_PATTERN = /^[A-Za-z0-9_]{1,10}$/;

export function sanitizeWidgetName(name: string): string {
  const trimmed = String(name).trim();
  if (!WIDGET_NAME_PATTERN.test(trimmed)) {
    throw new Error(
      `Invalid widget name "${name}": use 1–10 characters (letters, digits, underscore only)`
    );
  }
  return trimmed;
}

export function getGeneratedRoot(): string {
  return resolve(getRepoRoot(), "generated");
}

/** Ensures resolved path stays under generated/. */
export function assertUnderGenerated(resolvedPath: string): void {
  const root = getGeneratedRoot();
  const rel = relative(root, resolve(resolvedPath));
  if (rel.startsWith("..") || (rel.includes("..") && rel.split(sep).includes(".."))) {
    throw new Error("Path traversal detected");
  }
}

export function getGeneratedDir(widgetName: string): string {
  const safe = sanitizeWidgetName(widgetName);
  const dir = resolve(getGeneratedRoot(), safe);
  assertUnderGenerated(dir);
  return dir;
}

export function getWidgetLuaPath(widgetName: string): string {
  return join(getGeneratedDir(widgetName), "main.lua");
}
