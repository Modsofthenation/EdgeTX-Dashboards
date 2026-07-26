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
});
