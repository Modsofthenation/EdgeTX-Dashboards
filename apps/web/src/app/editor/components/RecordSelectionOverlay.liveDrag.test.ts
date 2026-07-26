import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const componentsDir = join(dirname(fileURLToPath(import.meta.url)), "../components");

describe("RecordSelectionOverlay live-drag lifecycle", () => {
  it("clears keep-alive liveDrag when records update after commit", () => {
    const src = readFileSync(
      join(componentsDir, "RecordSelectionOverlay.tsx"),
      "utf8",
    );
    assert.match(src, /useLayoutEffect\(\(\) => \{\s*setLiveDrag\(null\);\s*\}, \[records\]\)/s);
    assert.match(src, /selectionBoxWithLiveDrag/);
  });
});
