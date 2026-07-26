import {
  bboxForRecordInZone,
  interpretDocument,
  translateRecord,
  type DocumentRecord,
  type TextSizeFn,
  type ZoneOffset,
} from "@widget-gen/editor-core";

export type AlignMode =
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "center-x"
  | "center-y";

export type DistributeMode = "horizontal" | "vertical";

type Box = { id: string; x: number; y: number; w: number; h: number };

function boxesForSelection(
  records: DocumentRecord[],
  ids: string[],
  zone: ZoneOffset,
  measureText?: TextSizeFn,
): Box[] {
  const out: Box[] = [];
  for (const id of ids) {
    const record = records.find((r) => r.id === id);
    if (!record) continue;
    const box = bboxForRecordInZone(record, zone, measureText);
    if (!box) continue;
    out.push({ id, x: box.x, y: box.y, w: box.w, h: box.h });
  }
  return out;
}

function alignTargets(
  boxes: Box[],
  zone: ZoneOffset,
): { minX: number; maxR: number; minY: number; maxB: number; midX: number; midY: number } {
  // One selection → align to the canvas/zone. Two+ → align to the selection bounds.
  if (boxes.length === 1) {
    const minX = 0;
    const maxR = zone.zoneW;
    const minY = 0;
    const maxB = zone.zoneH;
    return {
      minX,
      maxR,
      minY,
      maxB,
      midX: (minX + maxR) / 2,
      midY: (minY + maxB) / 2,
    };
  }
  const minX = Math.min(...boxes.map((b) => b.x));
  const maxR = Math.max(...boxes.map((b) => b.x + b.w));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxB = Math.max(...boxes.map((b) => b.y + b.h));
  return {
    minX,
    maxR,
    minY,
    maxB,
    midX: (minX + maxR) / 2,
    midY: (minY + maxB) / 2,
  };
}

/** Align selected records; 1 item aligns to the zone, 2+ to each other. */
export function alignSelectedRecords(
  source: string,
  records: DocumentRecord[],
  ids: string[],
  zone: ZoneOffset,
  mode: AlignMode,
  measureText?: TextSizeFn,
): string {
  const boxes = boxesForSelection(records, ids, zone, measureText);
  if (boxes.length < 1) return source;

  const { minX, maxR, minY, maxB, midX, midY } = alignTargets(boxes, zone);

  let next = source;
  for (const box of boxes) {
    // Re-interpret after each patch so sourceRef spans stay valid when
    // coordinate digit lengths change (e.g. 10 → 100).
    const liveRecords = interpretDocument(next);
    const record = liveRecords.find((r) => r.id === box.id);
    if (!record) continue;

    let dx = 0;
    let dy = 0;
    switch (mode) {
      case "left":
        dx = minX - box.x;
        break;
      case "right":
        dx = maxR - (box.x + box.w);
        break;
      case "top":
        dy = minY - box.y;
        break;
      case "bottom":
        dy = maxB - (box.y + box.h);
        break;
      case "center-x":
        dx = midX - (box.x + box.w / 2);
        break;
      case "center-y":
        dy = midY - (box.y + box.h / 2);
        break;
    }
    dx = Math.round(dx);
    dy = Math.round(dy);
    if (dx === 0 && dy === 0) continue;
    next = translateRecord(next, record, dx, dy, zone);
  }
  return next;
}

/** Evenly distribute selected records along an axis (needs ≥3). */
export function distributeSelectedRecords(
  source: string,
  records: DocumentRecord[],
  ids: string[],
  zone: ZoneOffset,
  mode: DistributeMode,
  measureText?: TextSizeFn,
): string {
  const boxes = boxesForSelection(records, ids, zone, measureText);
  if (boxes.length < 3) return source;

  const sorted =
    mode === "horizontal"
      ? [...boxes].sort((a, b) => a.x - b.x || a.y - b.y)
      : [...boxes].sort((a, b) => a.y - b.y || a.x - b.x);

  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const gaps = sorted.length - 1;

  let next = source;
  if (mode === "horizontal") {
    const span = last.x - first.x;
    const step = span / gaps;
    for (let i = 1; i < sorted.length - 1; i++) {
      const box = sorted[i]!;
      const targetX = Math.round(first.x + step * i);
      const dx = targetX - box.x;
      if (dx === 0) continue;
      const live = interpretDocument(next).find((r) => r.id === box.id);
      if (!live) continue;
      next = translateRecord(next, live, dx, 0, zone);
    }
  } else {
    const span = last.y - first.y;
    const step = span / gaps;
    for (let i = 1; i < sorted.length - 1; i++) {
      const box = sorted[i]!;
      const targetY = Math.round(first.y + step * i);
      const dy = targetY - box.y;
      if (dy === 0) continue;
      const live = interpretDocument(next).find((r) => r.id === box.id);
      if (!live) continue;
      next = translateRecord(next, live, 0, dy, zone);
    }
  }
  return next;
}
