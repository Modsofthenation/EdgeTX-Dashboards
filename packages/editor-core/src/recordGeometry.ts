import { bboxForRecord, type DrawRecord } from "@widget-gen/layout-verify";
import type { DocumentRecord, ZoneOffset } from "./luaDocument.js";
import {
  snapToGrid,
  type BoundingBox,
  type ResizeHandle,
} from "./geometry.js";

/** Shift LCD-space record coords into zone-relative space for hit-testing and overlay. */
export function recordInZone(record: DrawRecord, zone: ZoneOffset): DrawRecord {
  const shifted: DrawRecord = { ...record };
  if (shifted.x != null) shifted.x -= zone.zoneX;
  if (shifted.y != null) shifted.y -= zone.zoneY;
  if (shifted.x2 != null) shifted.x2 -= zone.zoneX;
  if (shifted.y2 != null) shifted.y2 -= zone.zoneY;
  return shifted;
}

export function bboxForRecordInZone(
  record: DrawRecord,
  zone: ZoneOffset
): BoundingBox | null {
  if (record.kind === "clear") return null;
  return bboxForRecord(recordInZone(record, zone), zone.zoneW, zone.zoneH);
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
  zone: ZoneOffset
): DocumentRecord | null {
  for (let i = records.length - 1; i >= 0; i--) {
    const record = records[i]!;
    if (record.kind === "clear") continue;
    const box = bboxForRecordInZone(record, zone);
    if (!box) continue;
    const target = record.kind === "text" || record.kind === "line" ? hitTargetBox(box) : box;
    if (pointInBox(x, y, target)) return record;
  }
  return null;
}

export function isRectLike(record: DrawRecord): boolean {
  return record.kind === "filledRect" || record.kind === "rect" || record.kind === "gauge";
}

export function resizeRecordBox(
  start: BoundingBox,
  handle: ResizeHandle,
  pointerX: number,
  pointerY: number,
  snap: boolean
): BoundingBox {
  const box = { ...start };
  if (handle.includes("e")) box.w = Math.max(4, pointerX - box.x);
  if (handle.includes("s")) box.h = Math.max(4, pointerY - box.y);
  if (handle.includes("w")) {
    box.w = Math.max(4, box.x + box.w - pointerX);
    box.x = pointerX;
  }
  if (handle.includes("n")) {
    box.h = Math.max(4, box.y + box.h - pointerY);
    box.y = pointerY;
  }
  if (snap) {
    box.x = snapToGrid(box.x);
    box.y = snapToGrid(box.y);
    box.w = snapToGrid(box.w);
    box.h = snapToGrid(box.h);
  }
  return box;
}

export function recordLayerLabel(record: DrawRecord): string {
  if (record.kind === "text") return record.text?.slice(0, 24) ?? "Text";
  if (record.sourceLine) return `${record.kind} L${record.sourceLine}`;
  return record.kind;
}

export function recordsForDisplay(
  records: DrawRecord[],
  zone: ZoneOffset
): DrawRecord[] {
  return records.map((r) => recordInZone(r, zone));
}
