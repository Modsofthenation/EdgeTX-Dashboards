import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findOverlaps } from "./overlap.ts";
import type { DrawRecord } from "./types.ts";

describe("findOverlaps", () => {
  it("reports annulus vs foreign text overlap above gauge", () => {
    const records: DrawRecord[] = [
      { kind: "annulus", x: 240, y: 88, rIn: 40, rOut: 52 },
      { kind: "text", x: 252, y: 76, text: "BATTERY", fontSize: 10 },
    ];
    const hits = findOverlaps(records);
    assert.ok(hits.length >= 1);
  });

  it("skips text inside annulus inner radius", () => {
    const records: DrawRecord[] = [
      { kind: "annulus", x: 240, y: 160, rIn: 40, rOut: 52 },
      { kind: "text", x: 240, y: 150, text: "49", fontSize: 20, textAlign: "center" },
    ];
    const hits = findOverlaps(records);
    assert.equal(hits.length, 0);
  });

  it("skips text contained in parent filledRect", () => {
    const records: DrawRecord[] = [
      { kind: "filledRect", x: 10, y: 10, w: 200, h: 80 },
      { kind: "text", x: 20, y: 20, text: "LINK", fontSize: 10 },
    ];
    const hits = findOverlaps(records);
    assert.equal(hits.length, 0);
  });

  it("ignores filledRect vs text pairs", () => {
    const records: DrawRecord[] = [
      { kind: "filledRect", x: 0, y: 0, w: 50, h: 50 },
      { kind: "text", x: 200, y: 200, text: "X", fontSize: 10 },
    ];
    const hits = findOverlaps(records);
    assert.equal(hits.length, 0);
  });
});
