import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  getGeneratedDirForKey,
  getWidgetLuaPathForKey,
  isWidgetInstanceId,
  sanitizeWidgetInstanceId,
} from "./paths.js";

export const WIDGET_META_FILENAME = ".widget-meta.json";

export interface WidgetInstanceMeta {
  instanceId: string;
  displayName: string;
  version: number;
  updatedAt: number;
}

export function getWidgetMetaPath(instanceId: string): string {
  return join(getGeneratedDirForKey(sanitizeWidgetInstanceId(instanceId)), WIDGET_META_FILENAME);
}

export function readWidgetInstanceMeta(instanceId: string): WidgetInstanceMeta | null {
  try {
    const path = getWidgetMetaPath(instanceId);
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf-8")) as WidgetInstanceMeta;
  } catch {
    return null;
  }
}

export function writeWidgetInstanceMeta(meta: WidgetInstanceMeta): void {
  const id = sanitizeWidgetInstanceId(meta.instanceId);
  const dir = getGeneratedDirForKey(id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(getWidgetMetaPath(id), JSON.stringify({ ...meta, instanceId: id, updatedAt: Date.now() }, null, 2), "utf-8");
}

/** Resolve radio display name from meta or Lua `local name = "..."`. */
export function resolveDisplayName(workspaceKey: string): string | undefined {
  if (isWidgetInstanceId(workspaceKey)) {
    const meta = readWidgetInstanceMeta(workspaceKey);
    if (meta?.displayName) return meta.displayName;
  }
  try {
    const path = getWidgetLuaPathForKey(workspaceKey);
    if (!existsSync(path)) return isWidgetInstanceId(workspaceKey) ? undefined : workspaceKey;
    const source = readFileSync(path, "utf-8");
    const m = source.match(/local\s+name\s*=\s*"([^"]+)"/);
    return m?.[1];
  } catch {
    return isWidgetInstanceId(workspaceKey) ? undefined : workspaceKey;
  }
}

export function ensureWidgetInstanceDir(
  instanceId: string,
  displayName: string,
  version: number
): void {
  writeWidgetInstanceMeta({
    instanceId: sanitizeWidgetInstanceId(instanceId),
    displayName,
    version,
    updatedAt: Date.now(),
  });
}
