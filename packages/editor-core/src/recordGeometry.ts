import {
  bboxForRecord,
  edgeTxTextSize,
  type DrawRecord,
} from "@widget-gen/layout-verify";
import type { DocumentRecord, ZoneOffset } from "./luaDocument.ts";
import {
  SNAP_GRID,
  snapToGrid,
  type BoundingBox,
  type ResizeHandle,
} from "./geometry.ts";

export type TextSizeFn = (
  text: string,
  fontSize: number,
) => { w: number; h: number };

/** Shift LCD-space record coords into zone-relative space for hit-testing and overlay. */
export function recordInZone(record: DrawRecord, zone: ZoneOffset): DrawRecord {
  const shifted: DrawRecord = { ...record };
  if (shifted.x != null) shifted.x -= zone.zoneX;
  if (shifted.y != null) shifted.y -= zone.zoneY;
  if (shifted.x2 != null) shifted.x2 -= zone.zoneX;
  if (shifted.y2 != null) shifted.y2 -= zone.zoneY;
  return shifted;
}

function textBBox(
  record: DrawRecord,
  measureText?: TextSizeFn,
): BoundingBox | null {
  const fontSize = record.fontSize ?? 17;
  const text = record.text ?? "";
  // Prefer caller measure (selection uses edgeTxTextSize); fall back to the
  // same LCD metrics so outlines stay aligned with WASM when measure is omitted.
  const size = measureText
    ? measureText(text, fontSize)
    : edgeTxTextSize(text, fontSize);
  let x = record.x ?? 0;
  const y = record.y ?? 0;
  const align = record.textAlign ?? "left";
  if (align === "center") x -= size.w / 2;
  else if (align === "right") x -= size.w;
  // Small pad so antialiased glyph ink stays inside the outline.
  const padX = 1;
  const padY = 1;
  return {
    x: x - padX,
    y: y - padY,
    w: size.w + padX * 2,
    h: size.h + padY * 2,
  };
}

export function bboxForRecordInZone(
  record: DrawRecord,
  zone: ZoneOffset,
  measureText?: TextSizeFn,
): BoundingBox | null {
  if (record.kind === "clear") return null;
  const shifted = recordInZone(record, zone);
  if (shifted.kind === "text") return textBBox(shifted, measureText);
  return bboxForRecord(shifted, zone.zoneW, zone.zoneH);
}

function hitTargetBox(box: BoundingBox, minSize = 12): BoundingBox {
  const w = Math.max(box.w, minSize);
  const h = Math.max(box.h, minSize);
  return {
    x: box.x - (w - box.w) / 2,
    y: box.y - (h - box.h) / 2,
    w,
    h,
  };
}

function pointInBox(x: number, y: number, box: BoundingBox): boolean {
  return x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
}

/** Top-most editable record at zone coordinates (reverse paint order). */
export function hitTestRecords(
  records: DocumentRecord[],
  x: number,
  y: number,
  zone: ZoneOffset,
  measureText?: TextSizeFn,
): DocumentRecord | null {
  for (let i = records.length - 1; i >= 0; i--) {
    const record = records[i]!;
    if (record.kind === "clear") continue;
    const box = bboxForRecordInZone(record, zone, measureText);
    if (!box) continue;
    const target =
      record.kind === "text" || record.kind === "line"
        ? hitTargetBox(box)
        : box;
    if (pointInBox(x, y, target)) return record;
  }
  return null;
}

export function isRectLike(record: DrawRecord): boolean {
  return (
    record.kind === "filledRect" ||
    record.kind === "rect" ||
    record.kind === "gauge"
  );
}

const MIN_RESIZE = 4;

export function resizeRecordBox(
  start: BoundingBox,
  handle: ResizeHandle,
  pointerX: number,
  pointerY: number,
  snap: boolean,
): BoundingBox {
  const right = start.x + start.w;
  const bottom = start.y + start.h;
  const minSize = snap ? SNAP_GRID : MIN_RESIZE;
  let x = start.x;
  let y = start.y;
  let w = start.w;
  let h = start.h;

  if (handle.includes("e")) w = Math.max(minSize, pointerX - x);
  if (handle.includes("s")) h = Math.max(minSize, pointerY - y);
  if (handle.includes("w")) {
    w = Math.max(minSize, right - pointerX);
    x = right - w;
  }
  if (handle.includes("n")) {
    h = Math.max(minSize, bottom - pointerY);
    y = bottom - h;
  }

  if (snap) {
    x = snapToGrid(x);
    y = snapToGrid(y);
    w = snapToGrid(w);
    h = snapToGrid(h);
  }

  w = Math.max(minSize, w);
  h = Math.max(minSize, h);
  // Keep the opposite edge fixed after snap/min clamps.
  if (handle.includes("w")) x = right - w;
  if (handle.includes("n")) y = bottom - h;

  return { x, y, w, h };
}

export function recordLayerLabel(record: DrawRecord): string {
  if (record.kind === "text") return record.text?.slice(0, 24) ?? "Text";
  if (record.sourceLine) return `${record.kind} L${record.sourceLine}`;
  return record.kind;
}

export function recordsForDisplay(
  records: DrawRecord[],
  zone: ZoneOffset,
): DrawRecord[] {
  return records.map((r) => recordInZone(r, zone));
}

/** Transient geometry while dragging/resizing — applied visually before Lua commit. */
export type LiveDragState =
  | {
      mode: "move";
      ids: string[];
      dx: number;
      dy: number;
    }
  | {
      mode: "resize";
      ids: string[];
      box: BoundingBox;
    };

/**
 * Apply in-progress drag/resize to zone-space (or LCD-space) draw records.
 * Used by the canvas preview + selection overlay so pointermove never rewrites Lua.
 */
export function applyLiveDragToRecords<T extends DrawRecord & { id?: string }>(
  records: T[],
  live: LiveDragState | null | undefined,
): T[] {
  if (!live || live.ids.length === 0) return records;

  if (live.mode === "move") {
    if (live.dx === 0 && live.dy === 0) return records;
    const idSet = new Set(live.ids);
    return records.map((r) => {
      if (!r.id || !idSet.has(r.id)) return r;
      const next = { ...r };
      if (next.x != null) next.x += live.dx;
      if (next.y != null) next.y += live.dy;
      if (next.x2 != null) next.x2 += live.dx;
      if (next.y2 != null) next.y2 += live.dy;
      return next;
    });
  }

  const id = live.ids[0];
  if (!id) return records;
  const { box } = live;
  return records.map((r) => {
    if (r.id !== id) return r;
    return {
      ...r,
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
    };
  });
}

export function rectsIntersect(a: BoundingBox, b: BoundingBox): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

/** Normalize a rubber-band rect from two zone-space corners. */
export function normalizeRect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): BoundingBox {
  const x = Math.min(x0, x1);
  const y = Math.min(y0, y1);
  return {
    x,
    y,
    w: Math.abs(x1 - x0),
    h: Math.abs(y1 - y0),
  };
}
