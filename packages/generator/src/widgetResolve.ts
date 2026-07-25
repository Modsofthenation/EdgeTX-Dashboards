import { existsSync, readdirSync, statSync } from "node:fs";
import { getWidgetLuaPath, getWidgetLuaPathForKey, WIDGET_NAME_PATTERN, isWidgetInstanceId } from "./paths.ts";
import { getGeneratedRoot } from "./paths.ts";

/** Prefer session-assigned widget workspace over the most recently modified folder on disk. */
export function pickActiveWidgetName(options: {
  hint?: string;
  assigned?: string;
  assignedInstanceId?: string;
  lastKnown?: string;
  exists: (name: string) => boolean;
  latest?: () => string | undefined;
}): string | undefined {
  const { hint, assigned, assignedInstanceId, lastKnown, exists, latest } = options;

  for (const candidate of [hint, assignedInstanceId, lastKnown, assigned]) {
    if (candidate && exists(candidate)) return candidate;
  }

  if (assignedInstanceId) return assignedInstanceId;
  if (hint) return hint;
  if (assigned) return assigned;

  return latest?.();
}

export function findLatestWidgetName(): string | undefined {
  const generatedDir = getGeneratedRoot();
  if (!existsSync(generatedDir)) return undefined;

  let latest: { name: string; mtime: number } | undefined;

  for (const entry of readdirSync(generatedDir)) {
    const isInstance = isWidgetInstanceId(entry);
    const isLegacy = WIDGET_NAME_PATTERN.test(entry);
    if (!isInstance && !isLegacy) continue;
    const luaPath = isInstance ? getWidgetLuaPathForKey(entry) : getWidgetLuaPath(entry);
    if (!existsSync(luaPath)) continue;
    try {
      const mtime = statSync(luaPath).mtimeMs;
      if (!latest || mtime > latest.mtime) {
        latest = { name: entry, mtime };
      }
    } catch {
      // skip unreadable entries
    }
  }

  return latest?.name;
}
