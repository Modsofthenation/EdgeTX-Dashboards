import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  alignSelectedRecords,
  distributeSelectedRecords,
} from "./alignSelection.ts";
import type { DocumentRecord, ZoneOffset } from "@widget-gen/editor-core";

const zone: ZoneOffset = {
  zoneX: 0,
  zoneY: 0,
  zoneW: 480,
  zoneH: 320,
};

function rect(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
): DocumentRecord {
  return {
    id,
    kind: "filledRect",
    sourceLine: 0,
    x,
    y,
    w,
    h,
  } as DocumentRecord;
}

describe("alignSelection", () => {
  it("is a no-op with fewer than 2 ids", () => {
    const source = "-- empty";
    const records = [rect("a", 10, 10, 20, 20), rect("b", 40, 10, 20, 20)];
    const next = alignSelectedRecords(source, records, ["a"], zone, "left");
    assert.equal(next, source);
  });

  it("requires 3 ids to distribute", () => {
    const source = "-- empty";
    const records = [rect("a", 0, 0, 10, 10), rect("b", 20, 0, 10, 10)];
    const next = distributeSelectedRecords(
      source,
      records,
      ["a", "b"],
      zone,
      "horizontal",
    );
    assert.equal(next, source);
  });
});
