import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { snapDeltaToGuides, type BoundingBox } from "./geometry.ts";

describe("snapDeltaToGuides", () => {
  it("snaps to LCD left edge", () => {
    const moving: BoundingBox[] = [{ x: 5, y: 10, w: 40, h: 20 }];
    const result = snapDeltaToGuides(-3, 0, moving, [], { w: 480, h: 320 });
    assert.equal(result.dx, -5);
    assert.ok(result.guides.some((g) => g.orientation === "v" && g.pos === 0));
  });

  it("snaps to another element's right edge", () => {
    const moving: BoundingBox[] = [{ x: 100, y: 0, w: 40, h: 20 }];
    const others: BoundingBox[] = [{ x: 0, y: 0, w: 90, h: 20 }];
    const result = snapDeltaToGuides(-8, 0, moving, others, {
      w: 480,
      h: 320,
    });
    assert.equal(result.dx, -10);
    assert.ok(result.guides.some((g) => g.orientation === "v" && g.pos === 90));
  });

  it("falls back to 12px grid when far from guides", () => {
    const moving: BoundingBox[] = [{ x: 100, y: 100, w: 40, h: 20 }];
    const result = snapDeltaToGuides(7, 7, moving, [], { w: 480, h: 320 });
    assert.equal(result.dx, 12);
    assert.equal(result.dy, 12);
  });
});
