import { bboxForRecord } from "@widget-gen/layout-verify";
import type { DrawRecord } from "@widget-gen/layout-verify";
import type { EditorElement } from "./types.ts";

export const SNAP_GRID = 12;

export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function snapToGrid(
  value: number,
  grid = SNAP_GRID,
  enabled = true,
): number {
  if (!enabled) return Math.round(value);
  return Math.round(value / grid) * grid;
}

export type SnapGuide = {
  orientation: "v" | "h";
  /** Position in zone coordinates */
  pos: number;
};

export type SnapDeltaResult = {
  dx: number;
  dy: number;
  guides: SnapGuide[];
};

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values.map((v) => Math.round(v)))].sort((a, b) => a - b);
}

function edgeTargets(boxes: BoundingBox[], axis: "x" | "y"): number[] {
  const out: number[] = [];
  for (const box of boxes) {
    if (axis === "x") {
      out.push(box.x, box.x + box.w / 2, box.x + box.w);
    } else {
      out.push(box.y, box.y + box.h / 2, box.y + box.h);
    }
  }
  return out;
}

/**
 * Snap a move delta to LCD edges/centers and other element edges/centers.
 * Falls back to grid snap when no guide is within threshold.
 */
export function snapDeltaToGuides(
  dx: number,
  dy: number,
  movingBoxes: BoundingBox[],
  otherBoxes: BoundingBox[],
  zone: { w: number; h: number },
  opts?: { threshold?: number; grid?: number; gridEnabled?: boolean },
): SnapDeltaResult {
  const threshold = opts?.threshold ?? 6;
  const grid = opts?.grid ?? SNAP_GRID;
  const gridEnabled = opts?.gridEnabled !== false;

  if (movingBoxes.length === 0) {
    return {
      dx: gridEnabled ? snapToGrid(dx, grid, true) : Math.round(dx),
      dy: gridEnabled ? snapToGrid(dy, grid, true) : Math.round(dy),
      guides: [],
    };
  }

  const xGuides = uniqueSorted([
    0,
    zone.w / 2,
    zone.w,
    ...edgeTargets(otherBoxes, "x"),
  ]);
  const yGuides = uniqueSorted([
    0,
    zone.h / 2,
    zone.h,
    ...edgeTargets(otherBoxes, "y"),
  ]);

  let bestDx = dx;
  let bestDy = dy;
  let bestAbsDx = Number.POSITIVE_INFINITY;
  let bestAbsDy = Number.POSITIVE_INFINITY;
  let snapGuideX: number | null = null;
  let snapGuideY: number | null = null;

  for (const box of movingBoxes) {
    for (const edge of [
      box.x + dx,
      box.x + box.w / 2 + dx,
      box.x + box.w + dx,
    ]) {
      for (const guide of xGuides) {
        const delta = guide - edge;
        const abs = Math.abs(delta);
        if (abs <= threshold && abs < bestAbsDx) {
          bestAbsDx = abs;
          bestDx = dx + delta;
          snapGuideX = guide;
        }
      }
    }
    for (const edge of [
      box.y + dy,
      box.y + box.h / 2 + dy,
      box.y + box.h + dy,
    ]) {
      for (const guide of yGuides) {
        const delta = guide - edge;
        const abs = Math.abs(delta);
        if (abs <= threshold && abs < bestAbsDy) {
          bestAbsDy = abs;
          bestDy = dy + delta;
          snapGuideY = guide;
        }
      }
    }
  }

  if (snapGuideX == null) {
    bestDx = gridEnabled ? snapToGrid(dx, grid, true) : Math.round(dx);
  }
  if (snapGuideY == null) {
    bestDy = gridEnabled ? snapToGrid(dy, grid, true) : Math.round(dy);
  }

  const guides: SnapGuide[] = [];
  if (snapGuideX != null) guides.push({ orientation: "v", pos: snapGuideX });
  if (snapGuideY != null) guides.push({ orientation: "h", pos: snapGuideY });

  return { dx: bestDx, dy: bestDy, guides };
}

export function elementToDrawRecord(el: EditorElement): DrawRecord | null {
  if (!el.visible) return null;

  switch (el.kind) {
    case "text":
      return {
        kind: "text",
        x: el.x,
        y: el.y,
        text: el.content ?? el.binding?.sensorKey ?? "",
        fontSize: el.fontSize,
        color: el.color,
        textAlign: el.textAlign,
      };
    case "filledRect":
    case "rect":
      return {
        kind: el.kind === "filledRect" ? "filledRect" : "rect",
        x: el.x,
        y: el.y,
        w: el.w,
        h: el.h,
        color: el.color,
      };
    case "line":
      return {
        kind: "line",
        x: el.x1,
        y: el.y1,
        x2: el.x2,
        y2: el.y2,
        color: el.color,
      };
    case "gauge":
      return {
        kind: "gauge",
        x: el.x,
        y: el.y,
        w: el.w,
        h: el.h,
        color: el.color,
        fill: el.fill,
        maxFill: el.maxFill,
      };
    case "circle":
    case "filledCircle":
      return {
        kind: el.kind,
        x: el.x,
        y: el.y,
        r: el.r,
        color: el.color,
      };
    case "arc":
      return {
        kind: "arc",
        x: el.x,
        y: el.y,
        r: el.r,
        startAngle: el.startAngle,
        endAngle: el.endAngle,
        color: el.color,
      };
    case "annulus":
      return {
        kind: "annulus",
        x: el.x,
        y: el.y,
        rIn: el.rIn,
        rOut: el.rOut,
        startAngle: el.startAngle,
        endAngle: el.endAngle,
        color: el.color,
      };
    case "bitmap":
      return {
        kind: "bitmap",
        x: el.x,
        y: el.y,
        placeholder: el.placeholder,
      };
    default:
      return null;
  }
}

export function bboxForElement(
  el: EditorElement,
  lcdW = 480,
  lcdH = 320,
): BoundingBox | null {
  const record = elementToDrawRecord(el);
  if (!record) return null;
  return bboxForRecord(record, lcdW, lcdH);
}

export function pointInBox(px: number, py: number, box: BoundingBox): boolean {
  return (
    px >= box.x && px <= box.x + box.w && py >= box.y && py <= box.y + box.h
  );
}

function hitTargetBox(el: EditorElement, box: BoundingBox): BoundingBox {
  // Small text/lines are hard to select at 1:1 scale, so widen hit area only.
  const basePad = el.kind === "line" ? 8 : 5;
  let x = box.x - basePad;
  let y = box.y - basePad;
  let w = box.w + basePad * 2;
  let h = box.h + basePad * 2;

  const minW = el.kind === "line" ? 18 : el.kind === "text" ? 28 : 12;
  const minH = el.kind === "line" ? 18 : el.kind === "text" ? 18 : 12;
  if (w < minW) {
    x -= (minW - w) / 2;
    w = minW;
  }
  if (h < minH) {
    y -= (minH - h) / 2;
    h = minH;
  }

  return { x, y, w, h };
}

/** Hit-test elements top-to-bottom (last drawn = first hit). */
export function hitTestElements(
  elements: EditorElement[],
  px: number,
  py: number,
  lcdW = 480,
  lcdH = 320,
): string | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (!el.visible) continue;
    const box = bboxForElement(el, lcdW, lcdH);
    if (!box) continue;
    if (pointInBox(px, py, hitTargetBox(el, box))) return el.id;
  }
  return null;
}

export function translateElement(
  el: EditorElement,
  dx: number,
  dy: number,
): EditorElement {
  switch (el.kind) {
    case "text":
    case "filledRect":
    case "rect":
    case "gauge":
    case "circle":
    case "filledCircle":
    case "arc":
    case "annulus":
    case "bitmap":
      return { ...el, x: el.x + dx, y: el.y + dy };
    case "line":
      return {
        ...el,
        x1: el.x1 + dx,
        y1: el.y1 + dy,
        x2: el.x2 + dx,
        y2: el.y2 + dy,
      };
    default:
      return el;
  }
}

export function resizeRectElement(
  el: EditorElement,
  newBox: BoundingBox,
  handle: ResizeHandle,
): EditorElement {
  if (el.kind !== "filledRect" && el.kind !== "rect" && el.kind !== "gauge")
    return el;

  const minSize = 4;
  let { x, y, w, h } = newBox;

  if (w < minSize) w = minSize;
  if (h < minSize) h = minSize;

  if (handle.includes("w")) {
    x = newBox.x + newBox.w - w;
  }
  if (handle.includes("n")) {
    y = newBox.y + newBox.h - h;
  }

  return {
    ...el,
    x: Math.round(x),
    y: Math.round(y),
    w: Math.round(w),
    h: Math.round(h),
  };
}

export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export const RESIZE_HANDLES: ResizeHandle[] = [
  "nw",
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
];

export function handlePosition(
  box: BoundingBox,
  handle: ResizeHandle,
): { x: number; y: number } {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const right = box.x + box.w;
  const bottom = box.y + box.h;

  switch (handle) {
    case "nw":
      return { x: box.x, y: box.y };
    case "n":
      return { x: cx, y: box.y };
    case "ne":
      return { x: right, y: box.y };
    case "e":
      return { x: right, y: cy };
    case "se":
      return { x: right, y: bottom };
    case "s":
      return { x: cx, y: bottom };
    case "sw":
      return { x: box.x, y: bottom };
    case "w":
      return { x: box.x, y: cy };
    default:
      return { x: cx, y: cy };
  }
}
