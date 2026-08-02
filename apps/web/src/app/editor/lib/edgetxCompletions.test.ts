import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  availableCompletionStubVersions,
  edgeTxCompletionsFor,
  listEdgeTxCompletionLabels,
  resolveCompletionCatalog,
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
  it("exposes catalogs for each picker EdgeTX version", () => {
    const versions = availableCompletionStubVersions();
    assert.ok(versions.includes("2.10"));
    assert.ok(versions.includes("2.11"));
    assert.ok(versions.includes("2.12"));
  });

  it("loads EdgeTX API labels from the selected stub catalog", () => {
    const labels = listEdgeTxCompletionLabels("2.11.0");
    assert.ok(labels.includes("lcd.drawText"));
    assert.ok(labels.includes("getValue"));
    assert.ok(labels.includes("WHITE"));
    assert.ok(labels.includes("BOLD"));
  });

  it("uses different catalogs per EdgeTX version", () => {
    const v10 = resolveCompletionCatalog("2.10.0").items.length;
    const v11 = resolveCompletionCatalog("2.11.0").items.length;
    const v12 = resolveCompletionCatalog("2.12.0").items.length;
    assert.ok(v10 > 0);
    assert.ok(v11 >= v10);
    assert.ok(v12 >= v11);
    assert.notEqual(v10, v12);
  });

  it("suggests lcd members after a module dot for the selected version", () => {
    const result = edgeTxCompletionsFor("2.12.0")(fakeContext("lcd."));
    assert.ok(result);
    const labels = result!.options.map((o) => o.label);
    assert.ok(labels.some((l) => l === "lcd.drawText"));
    assert.ok(labels.some((l) => l === "lcd.clear"));
    assert.ok(!labels.some((l) => l === "getValue"));
  });

  it("suggests globals and constants from a prefix", () => {
    const result = edgeTxCompletionsFor("2.11.0")(fakeContext("getV"));
    assert.ok(result);
    const labels = result!.options.map((o) => o.label);
    assert.ok(labels.includes("getValue"));
  });

  it("suggests Lua keywords", () => {
    const result = edgeTxCompletionsFor("2.11.0")(fakeContext("loc"));
    assert.ok(result);
    assert.ok(result!.options.some((o) => o.label === "local"));
  });
});
