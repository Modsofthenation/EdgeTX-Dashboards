import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { bboxForRecord, boxesOverlap } from "../bbox.js";

describe("bboxForRecord", () => {
  it("computes annulus outer circle bbox from rIn/rOut", () => {
    const box = bboxForRecord({
      kind: "annulus",
      x: 240,
      y: 160,
      rIn: 40,
      rOut: 52,
    });
    assert.ok(box);
    assert.equal(box!.x, 240 - 52);
    assert.equal(box!.y, 160 - 52);
    assert.equal(box!.w, 104);
    assert.equal(box!.h, 104);
  });

  it("computes right-aligned text bbox", () => {
    const box = bboxForRecord({
      kind: "text",
      x: 100,
      y: 50,
      text: "78%",
      fontSize: 10,
      textAlign: "right",
    });
    assert.ok(box);
    assert.equal(box!.w, 18);
    assert.equal(box!.x, 82);
  });

  it("detects overlapping rects", () => {
    const a = bboxForRecord({ kind: "filledRect", x: 0, y: 0, w: 100, h: 50 })!;
    const b = bboxForRecord({ kind: "filledRect", x: 50, y: 25, w: 100, h: 50 })!;
    assert.equal(boxesOverlap(a, b), true);
  });
});
