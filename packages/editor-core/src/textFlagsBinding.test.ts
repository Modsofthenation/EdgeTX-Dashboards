import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STARTER_WIDGET_SOURCE } from "./starterSource.ts";
import { interpretDocument, setRecordTextFlags } from "./luaDocument.ts";
import { detectTextBinding } from "./telemetryBinding.ts";
import { bindTextRecordToSensorDetailed } from "./telemetryBinding.ts";

describe("setRecordTextFlags", () => {
  it("sets MIDSIZE and CENTER while keeping color", () => {
    const records = interpretDocument(STARTER_WIDGET_SOURCE);
    const text = records.find((r) => r.kind === "text" && r.text);
    assert.ok(text);
    const next = setRecordTextFlags(
      STARTER_WIDGET_SOURCE,
      text!,
      { size: "MIDSIZE", align: "CENTER" },
      { zoneX: 0, zoneY: 0, zoneW: 480, zoneH: 320 },
    );
    const line = next
      .split("\n")
      .find((l) => l.includes("lcd.drawText") && l.includes(text!.text!));
    assert.ok(line);
    assert.match(line!, /MIDSIZE/);
    assert.match(line!, /CENTER/);
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
