import { join, resolve, relative, sep } from "node:path";
import { getRepoRoot } from "./knowledge.ts";

/** EdgeTX widget names: max 10 chars, alphanumeric + underscore only. */
export const WIDGET_NAME_PATTERN = /^[A-Za-z0-9_]{1,10}$/;

/** UUID workspace folders under generated/ (one per chat widget instance). */
export const WIDGET_INSTANCE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function sanitizeWidgetName(name: string): string {
  const trimmed = String(name).trim();
  if (!WIDGET_NAME_PATTERN.test(trimmed)) {
    throw new Error(
      `Invalid widget name "${name}": use 1–10 characters (letters, digits, underscore only)`,
    );
  }
  return trimmed;
}

export function isWidgetInstanceId(key: string): boolean {
  return WIDGET_INSTANCE_ID_PATTERN.test(String(key).trim());
}

export function sanitizeWidgetInstanceId(id: string): string {
  const trimmed = String(id).trim().toLowerCase();
  if (!WIDGET_INSTANCE_ID_PATTERN.test(trimmed)) {
    throw new Error(`Invalid widget instance id "${id}": expected a UUID`);
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
  if (
    rel.startsWith("..") ||
    (rel.includes("..") && rel.split(sep).includes(".."))
  ) {
    throw new Error("Path traversal detected");
  }
}

/** Legacy display-name folder (pre-UUID workspaces). */
export function getGeneratedDir(widgetName: string): string {
  const safe = sanitizeWidgetName(widgetName);
  const dir = resolve(getGeneratedRoot(), safe);
  assertUnderGenerated(dir);
  return dir;
}

export function getWidgetLuaPath(widgetName: string): string {
  return join(getGeneratedDir(widgetName), "main.lua");
}

export function getWidgetInstanceDir(instanceId: string): string {
  const safe = sanitizeWidgetInstanceId(instanceId);
  const dir = resolve(getGeneratedRoot(), safe);
  assertUnderGenerated(dir);
  return dir;
}

export function getWidgetLuaPathForInstance(instanceId: string): string {
  return join(getWidgetInstanceDir(instanceId), "main.lua");
}

/** Instance UUID folder or legacy display-name folder. */
export function getGeneratedDirForKey(workspaceKey: string): string {
  if (isWidgetInstanceId(workspaceKey)) {
    return getWidgetInstanceDir(workspaceKey);
  }
  return getGeneratedDir(workspaceKey);
}

export function getWidgetLuaPathForKey(workspaceKey: string): string {
  return join(getGeneratedDirForKey(workspaceKey), "main.lua");
}
