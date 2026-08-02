import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  edgeTxCompletions,
  listEdgeTxCompletionLabels,
} from "./edgetxCompletions.ts";
import type { CompletionContext } from "@codemirror/autocomplete";

function fakeContext(
  text: string,
  pos?: number,
  explicit = true,
): CompletionContext {
  const doc = text;
  const position = pos ?? text.length;
  return {
    pos: position,
    explicit,
    state: {
      doc: {
        toString: () => doc,
        length: doc.length,
        sliceString: (from: number, to: number) => doc.slice(from, to),
      },
    },
    matchBefore(regex: RegExp) {
      const slice = doc.slice(0, position);
      const match = slice.match(new RegExp(regex.source + "$", regex.flags));
      if (!match) return null;
      return {
        from: position - match[0].length,
        to: position,
        text: match[0],
      };
    },
  } as unknown as CompletionContext;
}

describe("edgeTxCompletions", () => {
  it("loads EdgeTX API labels from the stub catalog", () => {
    const labels = listEdgeTxCompletionLabels();
    assert.ok(labels.includes("lcd.drawText"));
    assert.ok(labels.includes("getValue"));
    assert.ok(labels.includes("WHITE"));
    assert.ok(labels.includes("BOLD"));
  });

  it("suggests lcd members after a module dot", () => {
    const result = edgeTxCompletions(fakeContext("lcd."));
    assert.ok(result);
    const labels = result!.options.map((o) => o.label);
    assert.ok(labels.some((l) => l === "lcd.drawText"));
    assert.ok(labels.some((l) => l === "lcd.clear"));
    assert.ok(!labels.some((l) => l === "getValue"));
  });

  it("suggests globals and constants from a prefix", () => {
    const result = edgeTxCompletions(fakeContext("getV"));
    assert.ok(result);
    const labels = result!.options.map((o) => o.label);
    assert.ok(labels.includes("getValue"));
  });

  it("suggests Lua keywords", () => {
    const result = edgeTxCompletions(fakeContext("loc"));
    assert.ok(result);
    assert.ok(result!.options.some((o) => o.label === "local"));
  });
});
