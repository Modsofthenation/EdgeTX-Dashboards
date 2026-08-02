import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CANVAS_MIN, clampPanelWidths } from "./useResizableEditorPanels.ts";

const hooksDir = dirname(fileURLToPath(import.meta.url));

describe("useResizableEditorPanels contract", () => {
  it("persists widths, clamps panel size, and floors the canvas column", () => {
    const src = readFileSync(
      join(hooksDir, "useResizableEditorPanels.ts"),
      "utf8",
    );
    assert.match(src, /edgetx\.editor\.panelWidths\.v1/);
    assert.match(src, /LEFT_MIN = 160/);
    assert.match(src, /RIGHT_MIN = 180/);
    assert.match(src, /HANDLE = 12/);
    assert.match(src, /CANVAS_MIN = 280/);
    assert.match(src, /col-resize/);
    assert.match(src, /minmax\(\$\{CANVAS_MIN\}px, 1fr\)/);
    assert.match(src, /addEventListener\("pointermove"/);
    assert.match(src, /Attach synchronously/);
    assert.match(src, /schedulePersist/);
    assert.match(src, /applyWidthsLive/);
  });
});

describe("clampPanelWidths", () => {
  it("leaves room for CANVAS_MIN when body is measured", () => {
    const next = clampPanelWidths({ left: 400, right: 400 }, 900);
    // 900 - 24 handles - 280 canvas = 596 for panels
    assert.ok(next.left + next.right <= 900 - 24 - CANVAS_MIN);
    assert.ok(next.left >= 160);
    assert.ok(next.right >= 180);
  });

  it("is a no-op when panels already fit", () => {
    const next = clampPanelWidths({ left: 240, right: 280 }, 1200);
    assert.deepEqual(next, { left: 240, right: 280 });
  });
});
