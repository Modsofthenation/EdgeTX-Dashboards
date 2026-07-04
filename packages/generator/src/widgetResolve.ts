import { existsSync, readdirSync, statSync } from "node:fs";
import { getWidgetLuaPath, WIDGET_NAME_PATTERN } from "./paths.js";
import { getGeneratedRoot } from "./paths.js";

export function findLatestWidgetName(): string | undefined {
  const generatedDir = getGeneratedRoot();
  if (!existsSync(generatedDir)) return undefined;

  let latest: { name: string; mtime: number } | undefined;

  for (const entry of readdirSync(generatedDir)) {
    if (!WIDGET_NAME_PATTERN.test(entry)) continue;
    const luaPath = getWidgetLuaPath(entry);
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
