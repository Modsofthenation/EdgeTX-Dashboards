import type { BoundingBox, DrawRecord } from "./types.js";

/** TX15 character widths (px/char) — knowledge/design/tx15-text-layout.md */
const CHAR_W: Record<number, number> = {
  12: 6,
  18: 9,
  26: 12,
  10: 6,
  14: 9,
  20: 12,
};

function charWidth(fontSize: number): number {
  return CHAR_W[fontSize] ?? 6;
}

export function bboxForRecord(record: DrawRecord, lcdW = 480, lcdH = 320): BoundingBox | null {
  switch (record.kind) {
    case "clear":
      return { x: 0, y: 0, w: lcdW, h: lcdH };

    case "filledRect":
    case "rect":
    case "gauge":
      return {
        x: record.x ?? 0,
        y: record.y ?? 0,
        w: record.w ?? 0,
        h: record.h ?? 0,
      };

    case "text": {
      const fontSize = record.fontSize ?? 12;
      const text = record.text ?? "";
      const w = Math.max(1, text.length * charWidth(fontSize));
      const h = fontSize;
      let x = record.x ?? 0;
      const y = record.y ?? 0;
      const align = record.textAlign ?? "left";
      if (align === "center") x -= Math.floor(w / 2);
      else if (align === "right") x -= w;
      return { x, y, w, h };
    }

    case "filledCircle":
    case "circle": {
      const r = record.r ?? 0;
      const cx = record.x ?? 0;
      const cy = record.y ?? 0;
      return { x: cx - r, y: cy - r, w: r * 2, h: r * 2 };
    }

    case "annulus": {
      const cx = record.x ?? 0;
      const cy = record.y ?? 0;
      const rIn = record.rIn ?? 0;
      const rOut = record.rOut ?? 0;
      const outer = Math.max(rIn, rOut);
      return { x: cx - outer, y: cy - outer, w: outer * 2, h: outer * 2 };
    }

    case "arc": {
      const r = record.r ?? 0;
      const cx = record.x ?? 0;
      const cy = record.y ?? 0;
      return { x: cx - r, y: cy - r, w: r * 2, h: r * 2 };
    }

    case "line": {
      const x1 = record.x ?? 0;
      const y1 = record.y ?? 0;
      const x2 = record.x2 ?? x1;
      const y2 = record.y2 ?? y1;
      const minX = Math.min(x1, x2);
      const minY = Math.min(y1, y2);
      return {
        x: minX,
        y: minY,
        w: Math.max(1, Math.abs(x2 - x1)),
        h: Math.max(1, Math.abs(y2 - y1)),
      };
    }

    case "bitmap":
      return {
        x: record.x ?? 0,
        y: record.y ?? 0,
        w: record.w ?? 72,
        h: record.h ?? 56,
      };

    default:
      return null;
  }
}

export function bboxCenter(box: BoundingBox): { x: number; y: number } {
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}

export function bboxContains(outer: BoundingBox, inner: BoundingBox): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

export function intersectBoxes(a: BoundingBox, b: BoundingBox): BoundingBox | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.w, b.x + b.w);
  const bottom = Math.min(a.y + a.h, b.y + b.h);
  if (right <= x || bottom <= y) return null;
  return { x, y, w: right - x, h: bottom - y };
}

export function boxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return intersectBoxes(a, b) !== null;
}
