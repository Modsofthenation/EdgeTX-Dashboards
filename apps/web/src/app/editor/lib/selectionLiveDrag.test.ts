import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { selectionBoxWithLiveDrag } from "./selectionLiveDrag.ts";

describe("selectionBoxWithLiveDrag", () => {
  const box = { x: 100, y: 50, w: 40, h: 20 };

  it("offsets move live drag for matching ids", () => {
    const next = selectionBoxWithLiveDrag("a", box, {
      mode: "move",
      ids: ["a"],
      dx: -30,
      dy: 0,
    });
    assert.deepEqual(next, { x: 70, y: 50, w: 40, h: 20 });
  });

  it("leaves box alone when live drag is cleared after commit", () => {
    // Committed Lua already includes dx=-30 → record bbox at x=70.
    const committed = { x: 70, y: 50, w: 40, h: 20 };
    assert.deepEqual(selectionBoxWithLiveDrag("a", committed, null), committed);
  });

  it("would double-apply if live move offset were kept after commit", () => {
    const committed = { x: 70, y: 50, w: 40, h: 20 };
    const staleLive = {
      mode: "move" as const,
      ids: ["a"],
      dx: -30,
      dy: 0,
    };
    const wrong = selectionBoxWithLiveDrag("a", committed, staleLive);
    assert.deepEqual(wrong, { x: 40, y: 50, w: 40, h: 20 });
  });

  it("uses live resize box", () => {
    const liveBox = { x: 10, y: 10, w: 80, h: 40 };
    const next = selectionBoxWithLiveDrag("a", box, {
      mode: "resize",
      ids: ["a"],
      box: liveBox,
    });
    assert.equal(next, liveBox);
  });
});
