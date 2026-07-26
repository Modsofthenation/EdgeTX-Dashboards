import {
  bboxForRecordInZone,
  translateRecord,
  type DocumentRecord,
  type TextSizeFn,
  type ZoneOffset,
} from "@widget-gen/editor-core";

export type AlignMode =
  "left" | "right" | "top" | "bottom" | "center-x" | "center-y";

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

/** Align selected records; returns updated Lua source (or original if <2). */
export function alignSelectedRecords(
  source: string,
  records: DocumentRecord[],
  ids: string[],
  zone: ZoneOffset,
  mode: AlignMode,
  measureText?: TextSizeFn,
): string {
  const boxes = boxesForSelection(records, ids, zone, measureText);
  if (boxes.length < 2) return source;

  const minX = Math.min(...boxes.map((b) => b.x));
  const maxR = Math.max(...boxes.map((b) => b.x + b.w));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxB = Math.max(...boxes.map((b) => b.y + b.h));
  const midX = (minX + maxR) / 2;
  const midY = (minY + maxB) / 2;

  let next = source;
  for (const box of boxes) {
    const record = records.find((r) => r.id === box.id);
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
      const record = records.find((r) => r.id === box.id);
      if (!record) continue;
      next = translateRecord(next, record, dx, 0, zone);
    }
  } else {
    const span = last.y - first.y;
    const step = span / gaps;
    for (let i = 1; i < sorted.length - 1; i++) {
      const box = sorted[i]!;
      const targetY = Math.round(first.y + step * i);
      const dy = targetY - box.y;
      if (dy === 0) continue;
      const record = records.find((r) => r.id === box.id);
      if (!record) continue;
      next = translateRecord(next, record, 0, dy, zone);
    }
  }
  return next;
}
