import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeCanvasLayout } from "./canvasLayout.ts";

describe("computeCanvasLayout", () => {
  it("fits the zone inside the frame without cropping at zoom 1", () => {
    const layout = computeCanvasLayout(800, 500, 480, 272);
    assert.equal(layout.zoom, 1);
    assert.ok(layout.drawW <= 800 + 0.001);
    assert.ok(layout.drawH <= 500 + 0.001);
    assert.ok(Math.abs(layout.drawW / layout.drawH - 480 / 272) < 0.001);
  });

  it("shrinks draw size when the frame narrows (sidebar resize)", () => {
    const wide = computeCanvasLayout(900, 500, 480, 272);
    const narrow = computeCanvasLayout(400, 500, 480, 272);
    assert.ok(narrow.drawW < wide.drawW);
    assert.ok(narrow.drawW <= 400 + 0.001);
    assert.ok(narrow.drawH <= 500 + 0.001);
  });
});
