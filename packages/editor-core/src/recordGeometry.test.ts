import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resizeRecordBox } from "./recordGeometry.ts";

describe("resizeRecordBox", () => {
  const start = { x: 24, y: 24, w: 48, h: 36 };

  it("keeps the east edge fixed when resizing west", () => {
    const box = resizeRecordBox(start, "w", 12, 30, false);
    assert.equal(box.x + box.w, start.x + start.w);
    assert.equal(box.w, 60);
    assert.equal(box.x, 12);
  });

  it("keeps the south edge fixed when resizing north", () => {
    const box = resizeRecordBox(start, "n", 30, 12, false);
    assert.equal(box.y + box.h, start.y + start.h);
    assert.equal(box.h, 48);
    assert.equal(box.y, 12);
  });

  it("does not snap width/height to zero", () => {
    const box = resizeRecordBox(start, "e", 28, 30, true);
    assert.ok(box.w >= 12);
    assert.ok(box.h >= 12);
  });

  it("re-anchors west after snap clamps", () => {
    const right = start.x + start.w;
    const box = resizeRecordBox(start, "w", 70, 30, true);
    assert.equal(box.x + box.w, right);
    assert.ok(box.w >= 12);
  });
});
