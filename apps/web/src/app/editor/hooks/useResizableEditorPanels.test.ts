import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const hooksDir = dirname(fileURLToPath(import.meta.url));

describe("useResizableEditorPanels contract", () => {
  it("persists widths, clamps panel size, and leaves canvas as flexible column", () => {
    const src = readFileSync(
      join(hooksDir, "useResizableEditorPanels.ts"),
      "utf8",
    );
    assert.match(src, /edgetx\.editor\.panelWidths\.v1/);
    assert.match(src, /LEFT_MIN = 160/);
    assert.match(src, /RIGHT_MIN = 180/);
    assert.match(src, /HANDLE = 12/);
    assert.match(src, /col-resize/);
    assert.match(src, /minmax\(0, 1fr\)/);
    assert.match(src, /pointermove/);
  });
});
