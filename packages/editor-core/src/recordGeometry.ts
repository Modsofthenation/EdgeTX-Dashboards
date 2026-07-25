import { bboxForRecord, type DrawRecord } from "@widget-gen/layout-verify";
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
  const fontSize = record.fontSize ?? 12;
  const text = record.text ?? "";
  const size = measureText
    ? measureText(text, fontSize)
    : { w: Math.max(1, text.length * Math.round(fontSize * 0.5)), h: fontSize };
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
