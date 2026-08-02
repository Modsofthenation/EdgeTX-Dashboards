import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STARTER_WIDGET_SOURCE } from "./starterSource.ts";
import {
  interpretDocument,
  setRecordColor,
  setRecordTextFlags,
} from "./luaDocument.ts";
import { detectTextBinding } from "./telemetryBinding.ts";
import { bindTextRecordToSensorDetailed } from "./telemetryBinding.ts";

const ZONE = { zoneX: 0, zoneY: 0, zoneW: 480, zoneH: 320 };

const MINIMAL_BOLD = `---@type WidgetScript
local function create(zone, options)
  return { zone = zone, options = options }
end
local function refresh(widget)
  lcd.clear()
  lcd.drawText(12, 12, "GO", BOLD + WHITE)
end
return { name = "T", options = {}, create = create, update = function() end, refresh = refresh, background = function() end }
`;

const MINIMAL_STD = `---@type WidgetScript
local function create(zone, options)
  return { zone = zone, options = options }
end
local function refresh(widget)
  lcd.clear()
  lcd.drawText(12, 12, "GO", WHITE)
end
return { name = "T", options = {}, create = create, update = function() end, refresh = refresh, background = function() end }
`;

describe("setRecordTextFlags", () => {
  it("sets MIDSIZE and CENTER while keeping color", () => {
    const records = interpretDocument(STARTER_WIDGET_SOURCE);
    const text = records.find((r) => r.kind === "text" && r.text);
    assert.ok(text);
    const next = setRecordTextFlags(
      STARTER_WIDGET_SOURCE,
      text!,
      { size: "MIDSIZE", align: "CENTER" },
      ZONE,
    );
    const line = next
      .split("\n")
      .find((l) => l.includes("lcd.drawText") && l.includes(text!.text!));
    assert.ok(line);
    assert.match(line!, /MIDSIZE/);
    assert.match(line!, /CENTER/);
  });

  it("preserves BOLD when only changing alignment", () => {
    const records = interpretDocument(MINIMAL_BOLD);
    const text = records.find((r) => r.kind === "text" && r.text === "GO");
    assert.ok(text);
    assert.equal(text!.fontSize, 20);
    const next = setRecordTextFlags(
      MINIMAL_BOLD,
      text!,
      { align: "CENTER" },
      ZONE,
    );
    assert.match(next, /\bBOLD\b/);
    assert.match(next, /\bCENTER\b/);
    assert.doesNotMatch(next, /\bSMLSIZE\b/);
  });
});

describe("setRecordColor font-mode preservation", () => {
  it("does not inject SMLSIZE when recoloring default STD text", () => {
    const records = interpretDocument(MINIMAL_STD);
    const text = records.find((r) => r.kind === "text" && r.text === "GO");
    assert.ok(text);
    assert.equal(text!.fontSize, 21);
    const next = setRecordColor(MINIMAL_STD, text!, "GREEN", ZONE);
    assert.match(next, /lcd\.drawText\(12, 12, "GO", GREEN\)/);
    assert.doesNotMatch(next, /\bSMLSIZE\b/);
  });

  it("keeps BOLD when recoloring BOLD text", () => {
    const records = interpretDocument(MINIMAL_BOLD);
    const text = records.find((r) => r.kind === "text" && r.text === "GO");
    assert.ok(text);
    const next = setRecordColor(MINIMAL_BOLD, text!, "GREEN", ZONE);
    assert.match(next, /\bBOLD\b/);
    assert.match(next, /\bGREEN\b/);
    assert.doesNotMatch(next, /\bSMLSIZE\b/);
  });
});

describe("detectTextBinding", () => {
  it("detects percent binding after bindTextRecordToSensorDetailed", () => {
    const records = interpretDocument(STARTER_WIDGET_SOURCE);
    const text = records.find((r) => r.kind === "text");
    assert.ok(text);
    const bound = bindTextRecordToSensorDetailed(
      STARTER_WIDGET_SOURCE,
      text!,
      "RQLY",
      "percent",
    );
    const live = interpretDocument(bound.source).find(
      (r) => r.id === bound.recordId,
    );
    assert.ok(live);
    const detected = detectTextBinding(bound.source, live!);
    assert.ok(detected);
    assert.equal(detected!.sensor, "RQLY");
    assert.equal(detected!.format, "percent");
  });
});
