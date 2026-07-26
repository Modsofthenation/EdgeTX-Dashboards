import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const componentsDir = dirname(fileURLToPath(import.meta.url));

describe("liveDrag single ownership", () => {
  it("EditorCanvas owns liveDrag and clears on records", () => {
    const src = readFileSync(join(componentsDir, "EditorCanvas.tsx"), "utf8");
    assert.match(
      src,
      /useLayoutEffect\(\(\) => \{\s*setLiveDrag\(null\);\s*\}, \[records\]\)/s,
    );
    assert.match(src, /liveDrag=\{liveDrag\}/);
    assert.match(src, /onLiveDragChange=\{setLiveDrag\}/);
  });

  it("RecordSelectionOverlay is controlled (no local liveDrag state)", () => {
    const src = readFileSync(
      join(componentsDir, "RecordSelectionOverlay.tsx"),
      "utf8",
    );
    assert.match(src, /liveDrag: LiveDragState \| null/);
    assert.doesNotMatch(src, /useState<LiveDragState/);
    assert.doesNotMatch(src, /useLayoutEffect\(\(\) => \{\s*setLiveDrag/);
    assert.match(src, /selectionBoxWithLiveDrag/);
  });
});
