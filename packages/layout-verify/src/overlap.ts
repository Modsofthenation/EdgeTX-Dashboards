import { bboxCenter, bboxContains, bboxForRecord, boxesOverlap, intersectBoxes } from "./bbox.ts";
import type { BoundingBox, DrawRecord, OverlapHit } from "./types.ts";

export interface OverlapPolicy {
  lcdW?: number;
  lcdH?: number;
}

function annulusInnerRadius(record: DrawRecord): number {
  if (record.kind !== "annulus") return 0;
  const rIn = record.rIn ?? 0;
  const rOut = record.rOut ?? 0;
  return Math.min(rIn, rOut);
}

function pointInsideCircle(cx: number, cy: number, r: number, px: number, py: number): boolean {
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

function isResolvableText(record: DrawRecord): boolean {
  if (record.kind !== "text") return true;
  const t = record.text ?? "";
  if (!t) return false;
  if (/\btruncStr\s*\(/.test(t) || /\bstring\.format\s*\(/.test(t)) return false;
  if (/widget\.|telem\s*\(/.test(t)) return false;
  if (t.includes("..")) return false;
  return true;
}

function isInnerGaugeReadout(annulus: DrawRecord, textBox: BoundingBox): boolean {
  const cx = annulus.x ?? 0;
  const cy = annulus.y ?? 0;
  const inner = annulusInnerRadius(annulus);
  const coreR = inner * 0.55;
  const center = bboxCenter(textBox);
  return pointInsideCircle(cx, cy, coreR, center.x, center.y);
}

function shouldSkipAnnulusText(annulus: DrawRecord, textBox: BoundingBox): boolean {
  const cx = annulus.x ?? 0;
  const cy = annulus.y ?? 0;
  const inner = annulusInnerRadius(annulus);
  const center = bboxCenter(textBox);

  if (isInnerGaugeReadout(annulus, textBox)) return true;

  // Satellite labels below the gauge disc
  if (center.y > cy + inner * 0.4) return true;

  const dx = Math.abs(center.x - cx);
  const dy = center.y - cy;

  // Side / upper-side strip labels (e.g. capacity "850"/"mAh" beside whoop gauge).
  // Keep text sitting on the top of the ring (small |dy|, moderate dx) as a real hit.
  if (dx > inner * 0.7 && dy > -inner * 1.1 && dy < inner * 0.5) {
    if (dy < -inner * 0.25 || dx > inner * 0.85) return true;
  }

  return false;
}

function shouldCheckPair(a: DrawRecord, b: DrawRecord, boxA: BoundingBox, boxB: BoundingBox): boolean {
  if (a.kind === "clear" || b.kind === "clear") return false;

  if (a.kind === "text" && b.kind === "text") {
    if (!isResolvableText(a) || !isResolvableText(b)) return false;
    if (bboxContains(boxA, boxB) || bboxContains(boxB, boxA)) return false;
    if (Math.abs((a.y ?? 0) - (b.y ?? 0)) < 4) return false;
    return true;
  }

  if (a.kind === "annulus" && b.kind === "text") {
    if (!isResolvableText(b)) return false;
    return !shouldSkipAnnulusText(a, boxB);
  }
  if (b.kind === "annulus" && a.kind === "text") {
    if (!isResolvableText(a)) return false;
    return !shouldSkipAnnulusText(b, boxA);
  }

  return false;
}

export function findOverlaps(
  records: DrawRecord[],
  policy: OverlapPolicy = {}
): OverlapHit[] {
  const lcdW = policy.lcdW ?? 480;
  const lcdH = policy.lcdH ?? 320;
  const hits: OverlapHit[] = [];

  const boxes: (BoundingBox | null)[] = records.map((r) => bboxForRecord(r, lcdW, lcdH));

  for (let i = 0; i < records.length - 1; i++) {
    const boxA = boxes[i];
    if (!boxA || boxA.w <= 0 || boxA.h <= 0) continue;

    for (let j = i + 1; j < records.length; j++) {
      const boxB = boxes[j];
      if (!boxB || boxB.w <= 0 || boxB.h <= 0) continue;

      if (!shouldCheckPair(records[i]!, records[j]!, boxA, boxB)) continue;
      if (!boxesOverlap(boxA, boxB)) continue;

      const intersection = intersectBoxes(boxA, boxB);
      if (!intersection) continue;

      if (records[i]!.kind === "text" && records[j]!.kind === "text") {
        const area = intersection.w * intersection.h;
        if (area < 48) continue;
        // Adjacent SMLSIZE rows often share a few pixels of bbox height — not a real collision.
        if (intersection.h < 6) continue;
      }

      hits.push({
        a: records[i]!,
        b: records[j]!,
        aIndex: i,
        bIndex: j,
        intersection,
      });
    }
  }

  return hits;
}

export function formatOverlapHit(hit: OverlapHit): string {
  const describe = (r: DrawRecord): string => {
    if (r.kind === "text") return `text "${(r.text ?? "").slice(0, 24)}"@y=${r.y}`;
    if (r.kind === "annulus") return `annulus@(${r.x},${r.y}) rOut=${r.rOut}`;
    if (r.kind === "filledCircle" || r.kind === "circle") return `${r.kind}@(${r.x},${r.y}) r=${r.r}`;
    return `${r.kind}@(${r.x},${r.y})`;
  };
  return `Layout overlap: ${describe(hit.a)} intersects ${describe(hit.b)}`;
}
