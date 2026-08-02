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
        previewPending: true,
      }),
      active,
    );
  });

  it("holds the final transform while approximate preview is pending", () => {
    assert.deepEqual(
      resolveCanvasLiveDrag({
        liveDrag: null,
        previewDragHold: move,
        showParserPreview: true,
        previewPending: true,
      }),
      move,
    );
  });

  it("drops the hold once preview commands catch up", () => {
    assert.equal(
      resolveCanvasLiveDrag({
        liveDrag: null,
        previewDragHold: move,
        showParserPreview: true,
        previewPending: false,
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
        previewPending: true,
      }),
      null,
    );
  });
});
