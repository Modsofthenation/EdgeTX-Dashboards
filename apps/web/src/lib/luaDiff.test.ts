import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { summarizeDiff, unifiedDiff } from "./luaDiff.ts";

describe("unifiedDiff", () => {
  it("marks added and removed lines", () => {
    const diff = unifiedDiff("a\nb\nc\n", "a\nx\nc\n");
    assert.match(diff, /^-b$/m);
    assert.match(diff, /^\+x$/m);
    const summary = summarizeDiff(diff);
    assert.equal(summary.added, 1);
    assert.equal(summary.removed, 1);
  });

  it("falls back when the LCS matrix would be too large", () => {
    const before = Array.from({ length: 400 }, (_, i) => `L${i}`).join("\n");
    const after = Array.from({ length: 400 }, (_, i) => `R${i}`).join("\n");
    const diff = unifiedDiff(before, after, {
      maxLines: 80,
      maxMatrixCells: 1_000,
    });
    assert.match(diff, /diff simplified: input too large|diff truncated/);
    assert.ok(diff.split("\n").length <= 82);
  });
});
