import { findRefreshBodyEndIndex } from "@widget-gen/shared";
import { getPrefabSection } from "./registry.ts";
import type { PrefabSection } from "./types.ts";

const CACHE_SOURCE_HELPER = `local function cacheSource(sensorName)
  local idx = getSourceIndex(sensorName)
  if idx and idx > 0 then return idx end
  return nil
end`;

const TELEM_HELPER = `local function telem(id)
  if id then return getValue(id) end
  return 0
end`;

function hasCacheSourceHelper(source: string): boolean {
  return /function\s+cacheSource\s*\(/.test(source);
}

function hasTelemHelper(source: string): boolean {
  return /function\s+telem\s*\(/.test(source);
}

function ensureHelpers(source: string): string {
  let next = source;
  if (!hasCacheSourceHelper(next)) {
    const nameDecl = next.match(/local\s+name\s*=\s*"[^"]*"\s*\n/);
    if (nameDecl && nameDecl.index !== undefined) {
      const at = nameDecl.index + nameDecl[0].length;
      next =
        next.slice(0, at) + "\n" + CACHE_SOURCE_HELPER + "\n" + next.slice(at);
    } else {
      next = CACHE_SOURCE_HELPER + "\n" + next;
    }
  }
  if (!hasTelemHelper(next)) {
    const cacheFn = next.match(/local\s+function\s+cacheSource[\s\S]*?\nend\n/);
    if (cacheFn && cacheFn.index !== undefined) {
      const at = cacheFn.index + cacheFn[0].length;
      next = next.slice(0, at) + "\n" + TELEM_HELPER + "\n" + next.slice(at);
    } else {
      next = TELEM_HELPER + "\n" + next;
    }
  }
  return next;
}

function findMatchingBrace(source: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function ensureSrcBindings(
  source: string,
  bindings: Record<string, string>,
): string {
  let next = source;
  const entries = Object.entries(bindings);
  if (entries.length === 0) return next;

  for (const [key, sensor] of entries) {
    if (
      new RegExp(
        `\\b${key}\\s*=\\s*(?:cacheSource|getSourceIndex)\\s*\\(\\s*"${sensor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`,
      ).test(next)
    ) {
      continue;
    }

    const srcTable = next.match(/\bsrc\s*=\s*\{/);
    if (srcTable && srcTable.index !== undefined) {
      const open = srcTable.index + srcTable[0].length - 1;
      const close = findMatchingBrace(next, open);
      if (close > open) {
        const insert = `\n      ${key} = cacheSource("${sensor}"),`;
        next = next.slice(0, close) + insert + next.slice(close);
        continue;
      }
    }

    const createReturn = next.match(
      /local\s+function\s+create\s*\([^)]*\)[\s\S]*?\breturn\s*\{/,
    );
    if (createReturn && createReturn.index !== undefined) {
      const insertAt = createReturn.index + createReturn[0].length;
      const snippet = `\n    src = { ${key} = cacheSource("${sensor}") },`;
      const after = next.slice(insertAt, insertAt + 120);
      if (/\bsrc\s*=/.test(after)) {
        // src exists but matcher missed — skip rather than duplicate table
        continue;
      }
      next = next.slice(0, insertAt) + snippet + next.slice(insertAt);
    }
  }

  return next;
}

function insertRefreshLines(source: string, lines: string[]): string {
  const bodyEnd = findRefreshBodyEndIndex(source);
  if (bodyEnd < 0) return source;
  const indent = "  ";
  const block = lines.map((l) => `${indent}${l}`).join("\n");
  const prefix = source.slice(0, bodyEnd);
  const needsLeadingNl = prefix.length > 0 && !prefix.endsWith("\n");
  return (
    prefix + (needsLeadingNl ? "\n" : "") + block + "\n" + source.slice(bodyEnd)
  );
}

function ensureModelBitmapLoad(source: string): string {
  if (/function\s+loadModelBitmap\s*\(/.test(source)) return source;
  if (/modelBmp\s*=/.test(source)) return source;

  const helper = `local function loadModelBitmap()
  local info = model.getInfo()
  local name = info and info.bitmap or ""
  if name == nil or name == "" then
    return nil, 0, 0
  end
  local bmp = Bitmap.open("/IMAGES/" .. name)
  if bmp == nil then
    return nil, 0, 0
  end
  local w, h = Bitmap.getSize(bmp)
  return bmp, w, h
end
`;

  let next = source;
  const telemFn = next.match(/local\s+function\s+telem[\s\S]*?\nend\n/);
  if (telemFn && telemFn.index !== undefined) {
    const at = telemFn.index + telemFn[0].length;
    next = next.slice(0, at) + "\n" + helper + next.slice(at);
  } else {
    next = helper + next;
  }

  const createFn = next.match(/local\s+function\s+create\s*\([^)]*\)\s*\n/);
  if (createFn && createFn.index !== undefined) {
    const bodyStart = createFn.index + createFn[0].length;
    if (!/loadModelBitmap\(\)/.test(next.slice(bodyStart, bodyStart + 400))) {
      next =
        next.slice(0, bodyStart) +
        "  local modelBmp, bmpW, bmpH = loadModelBitmap()\n" +
        next.slice(bodyStart);
    }
  }

  const createReturn = next.match(
    /local\s+function\s+create\s*\([^)]*\)[\s\S]*?\breturn\s*\{/,
  );
  if (createReturn && createReturn.index !== undefined) {
    const insertAt = createReturn.index + createReturn[0].length;
    if (!/modelBmp\s*=/.test(next.slice(insertAt, insertAt + 200))) {
      next =
        next.slice(0, insertAt) +
        "\n    modelBmp = modelBmp,\n    bmpW = bmpW,\n    bmpH = bmpH," +
        next.slice(insertAt);
    }
  }

  return next;
}

export interface InsertPrefabResult {
  source: string;
  prefab: PrefabSection;
  /** Approximate first inserted draw line id after interpret (best-effort). */
  insertedDrawCount: number;
}

/** Insert a prefab section into widget Lua (helpers + src cache + refresh body). */
export function insertPrefabSection(
  source: string,
  prefabId: string,
): InsertPrefabResult | null {
  const prefab = getPrefabSection(prefabId);
  if (!prefab) return null;

  let next = ensureHelpers(source);
  next = ensureSrcBindings(next, prefab.createSrcBindings);
  if (prefab.refreshLines.some((l) => /drawBitmap/.test(l))) {
    next = ensureModelBitmapLoad(next);
  }
  next = insertRefreshLines(next, [
    `-- prefab:${prefab.id}`,
    ...prefab.refreshLines,
  ]);

  const drawCount = prefab.refreshLines.filter((l) =>
    /^\s*lcd\.draw/.test(l),
  ).length;

  return { source: next, prefab, insertedDrawCount: drawCount };
}

/** Insert multiple prefabs in order (e.g. full RF heli-style board). */
export function insertPrefabSections(
  source: string,
  prefabIds: string[],
): { source: string; inserted: string[] } {
  let next = source;
  const inserted: string[] = [];
  for (const id of prefabIds) {
    const result = insertPrefabSection(next, id);
    if (!result) continue;
    next = result.source;
    inserted.push(id);
  }
  return { source: next, inserted };
}

/** Canonical RF heli TX15 layout order (electric). */
export const ROTORFLIGHT_ELECTRIC_LAYOUT_ORDER = [
  "rf-topbar-link",
  "rf-model-panel",
  "rf-governor-card",
  "rf-headspeed-hero",
  "rf-motor-tiles",
  "rf-battery-bar",
] as const;

/** Nitro / OMP RF heli TX15 order — pack tiles + RX voltage bar. */
export const ROTORFLIGHT_NITRO_LAYOUT_ORDER = [
  "rf-topbar-link",
  "rf-model-panel",
  "rf-governor-card",
  "rf-headspeed-hero",
  "rf-nitro-pack-tiles",
  "rf-nitro-rx-bar",
] as const;
