import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyLiveDragToRecords,
  resizeRecordBox,
} from "./recordGeometry.ts";

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

describe("applyLiveDragToRecords", () => {
  const records = [
    { id: "L10", kind: "filledRect" as const, x: 10, y: 20, w: 40, h: 30 },
    { id: "L11", kind: "text" as const, x: 50, y: 60, text: "Hi" },
  ];

  it("offsets selected records during move", () => {
    const next = applyLiveDragToRecords(records, {
      mode: "move",
      ids: ["L10"],
      dx: 5,
      dy: -3,
    });
    assert.equal(next[0]!.x, 15);
    assert.equal(next[0]!.y, 17);
    assert.equal(next[1]!.x, 50);
  });

  it("replaces box during resize", () => {
    const next = applyLiveDragToRecords(records, {
      mode: "resize",
      ids: ["L10"],
      box: { x: 1, y: 2, w: 80, h: 60 },
    });
    assert.deepEqual(
      { x: next[0]!.x, y: next[0]!.y, w: next[0]!.w, h: next[0]!.h },
      { x: 1, y: 2, w: 80, h: 60 },
    );
  });

  it("is a no-op without live state", () => {
    assert.equal(applyLiveDragToRecords(records, null), records);
  });
});
