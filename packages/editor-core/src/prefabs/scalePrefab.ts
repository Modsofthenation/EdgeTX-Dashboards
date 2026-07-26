import type { PrefabSection } from "./types.ts";

const BASE_W = 480;
const BASE_H = 320;

function scaleNum(n: number, factor: number): number {
  return Math.round(n * factor);
}

/**
 * Scale lcd.* coordinate literals in a prefab refresh line from the TX15
 * authoring size (480×320) to a target LCD (e.g. color272 480×272).
 */
export function scaleLcdCoordsInLine(
  line: string,
  sx: number,
  sy: number,
): string {
  const sxn = (n: number) => String(scaleNum(n, sx));
  const syn = (n: number) => String(scaleNum(n, sy));

  let next = line.replace(
    /\b(lcd\.draw(?:Filled)?Rectangle)\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)/g,
    (_m, fn: string, x: string, y: string, w: string, h: string) =>
      `${fn}(${sxn(+x)}, ${syn(+y)}, ${sxn(+w)}, ${syn(+h)}`,
  );

  next = next.replace(
    /\b(lcd\.drawText)\(\s*(-?\d+)\s*,\s*(-?\d+)/g,
    (_m, fn: string, x: string, y: string) => `${fn}(${sxn(+x)}, ${syn(+y)}`,
  );

  next = next.replace(
    /\b(lcd\.drawBitmap)\(([^,]+),\s*(-?\d+)\s*,\s*(-?\d+)/g,
    (_m, fn: string, handle: string, x: string, y: string) =>
      `${fn}(${handle}, ${sxn(+x)}, ${syn(+y)}`,
  );

  next = next.replace(
    /\b(lcd\.drawLine)\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)/g,
    (_m, fn: string, x1: string, y1: string, x2: string, y2: string) =>
      `${fn}(${sxn(+x1)}, ${syn(+y1)}, ${sxn(+x2)}, ${syn(+y2)}`,
  );

  // local sigY = 22 / local footerY = 272 — scale axis-named locals.
  next = next.replace(
    /\b(local\s+\w*[Yy]\w*\s*=\s*)(-?\d+)\b/g,
    (_m, prefix: string, n: string) => `${prefix}${syn(+n)}`,
  );
  next = next.replace(
    /\b(local\s+\w*[Xx]\w*\s*=\s*)(-?\d+)\b/g,
    (_m, prefix: string, n: string) => `${prefix}${sxn(+n)}`,
  );

  return next;
}

/** Scale a prefab section from 480×320 authoring coords to a target LCD. */
export function scalePrefabSection(
  section: PrefabSection,
  lcdW: number,
  lcdH: number,
  baseW = BASE_W,
  baseH = BASE_H,
): PrefabSection {
  if (lcdW === baseW && lcdH === baseH) return section;
  const sx = lcdW / baseW;
  const sy = lcdH / baseH;
  const b = section.defaultBounds;
  return {
    ...section,
    defaultBounds: {
      x: scaleNum(b.x, sx),
      y: scaleNum(b.y, sy),
      w: scaleNum(b.w, sx),
      h: scaleNum(b.h, sy),
    },
    refreshLines: section.refreshLines.map((line) =>
      scaleLcdCoordsInLine(line, sx, sy),
    ),
  };
}
