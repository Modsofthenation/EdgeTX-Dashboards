import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveLayerDropTarget,
  sameLayerDropHint,
  type LayerDropRect,
} from "./layerDropTarget.ts";

const rows: LayerDropRect[] = [
  { id: "a", top: 0, bottom: 20, mid: 10 },
  { id: "b", top: 20, bottom: 40, mid: 30 },
  { id: "c", top: 40, bottom: 60, mid: 50 },
];

describe("resolveLayerDropTarget", () => {
  it("returns before/after from midpoint and ignores dragged row", () => {
    assert.deepEqual(resolveLayerDropTarget(5, rows, "b"), {
      id: "a",
      place: "before",
    });
    assert.deepEqual(resolveLayerDropTarget(35, rows, "a"), {
      id: "b",
      place: "after",
    });
    assert.equal(resolveLayerDropTarget(25, rows, "b"), null);
  });

  it("returns null outside all rows", () => {
    assert.equal(resolveLayerDropTarget(-1, rows, "a"), null);
    assert.equal(resolveLayerDropTarget(100, rows, "a"), null);
  });
});

describe("sameLayerDropHint", () => {
  it("compares id and place", () => {
    assert.equal(
      sameLayerDropHint(
        { id: "a", place: "before" },
        { id: "a", place: "before" },
      ),
      true,
    );
    assert.equal(
      sameLayerDropHint(
        { id: "a", place: "before" },
        { id: "a", place: "after" },
      ),
      false,
    );
    assert.equal(sameLayerDropHint(null, null), true);
  });
});
