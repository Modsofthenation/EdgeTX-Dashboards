import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createStarterSource,
  interpretDocument,
  type ZoneOffset,
} from "@widget-gen/editor-core";
import {
  alignSelectedRecords,
  distributeSelectedRecords,
} from "./alignSelection.ts";

const zone: ZoneOffset = {
  zoneX: 0,
  zoneY: 0,
  zoneW: 480,
  zoneH: 320,
};

const TWO_RECTS = `---@type WidgetScript
---@simulate Layout1x1 zone=0
local function create(zone, options)
  return {}
end
local function refresh(widget)
  lcd.drawFilledRectangle(40, 20, 30, 20, DARKGREY)
  lcd.drawFilledRectangle(200, 80, 30, 20, GREY)
end
return { name = "AlignT", options = {}, create = create, refresh = refresh, update = function(w,o) return w end, background = function(w) end }
`;

describe("alignSelection", () => {
  it("is a no-op with no ids", () => {
    const source = createStarterSource();
    const records = interpretDocument(source);
    const next = alignSelectedRecords(source, records, [], zone, "left");
    assert.equal(next, source);
  });

  it("aligns a single rect to the left edge of the zone", () => {
    const source = TWO_RECTS;
    const records = interpretDocument(source);
    const id = records.find((r) => r.kind === "filledRect" && r.x === 40)!.id;
    const next = alignSelectedRecords(source, records, [id], zone, "left");
    assert.match(next, /drawFilledRectangle\(0, 20, 30, 20/);
    assert.match(next, /drawFilledRectangle\(200, 80, 30, 20/);
  });

  it("aligns two rects to the leftmost x", () => {
    const source = TWO_RECTS;
    const records = interpretDocument(source);
    const ids = records.filter((r) => r.kind === "filledRect").map((r) => r.id);
    assert.equal(ids.length, 2);
    const next = alignSelectedRecords(source, records, ids, zone, "left");
    assert.match(next, /drawFilledRectangle\(40, 20, 30, 20/);
    assert.match(next, /drawFilledRectangle\(40, 80, 30, 20/);
  });

  it("requires 3 ids to distribute", () => {
    const source = TWO_RECTS;
    const records = interpretDocument(source);
    const ids = records.filter((r) => r.kind === "filledRect").map((r) => r.id);
    const next = distributeSelectedRecords(
      source,
      records,
      ids,
      zone,
      "horizontal",
    );
    assert.equal(next, source);
  });
});
