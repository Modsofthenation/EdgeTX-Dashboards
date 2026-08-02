import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveCanvasLiveDrag } from "./previewDragHold.ts";
import type { LiveDragState } from "@widget-gen/editor-core";

const move: LiveDragState = {
  mode: "move",
  ids: ["L10"],
  dx: 12,
  dy: -4,
};

describe("resolveCanvasLiveDrag", () => {
  it("prefers the active gesture over a stale hold", () => {
    const active: LiveDragState = {
      mode: "move",
      ids: ["L10"],
      dx: 1,
      dy: 1,
    };
    assert.equal(
      resolveCanvasLiveDrag({
        liveDrag: active,
        previewDragHold: move,
        showParserPreview: true,
        sourcePending: true,
      }),
      active,
    );
  });

  it("holds the final transform while source interpret lags", () => {
    assert.deepEqual(
      resolveCanvasLiveDrag({
        liveDrag: null,
        previewDragHold: move,
        showParserPreview: true,
        sourcePending: true,
      }),
      move,
    );
  });

  it("drops the hold once source commands catch up", () => {
    assert.equal(
      resolveCanvasLiveDrag({
        liveDrag: null,
        previewDragHold: move,
        showParserPreview: true,
        sourcePending: false,
      }),
      null,
    );
  });

  it("does not hold when only scenario/profile would still be pending", () => {
    // Source already matches committed geometry; scenario mock lag must not
    // re-apply the drag delta (would overshoot).
    assert.equal(
      resolveCanvasLiveDrag({
        liveDrag: null,
        previewDragHold: move,
        showParserPreview: true,
        sourcePending: false,
      }),
      null,
    );
  });

  it("never holds in radio preview mode", () => {
    assert.equal(
      resolveCanvasLiveDrag({
        liveDrag: null,
        previewDragHold: move,
        showParserPreview: false,
        sourcePending: true,
      }),
      null,
    );
  });
});
