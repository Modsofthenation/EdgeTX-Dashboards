import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validatePromptIntent } from "./promptIntent.ts";

const RF_SENSORS = [
  "RxBt",
  "RQLY",
  "HSpd",
  "RPM",
  "EscT",
  "MotT",
  "FM",
  "Sats",
  "Curr",
  "Capa",
];

describe("validatePromptIntent", () => {
  it("errors when rotorflight headspeed is requested but missing", () => {
    const source = `local function create()
  return { src = { rxbt = cacheSource("RxBt"), esc = cacheSource("EscT") } }
end`;
    const issues = validatePromptIntent(
      "Rotorflight heli dashboard with headspeed, voltage, ESC temperature cards",
      source,
      { knownSensors: RF_SENSORS, strict: true },
    );
    assert.ok(issues.some((i) => /headspeed/i.test(i.message)));
    assert.equal(
      issues.find((i) => /headspeed/i.test(i.message))?.severity,
      "error",
    );
  });

  it("passes when all requested sensors are present", () => {
    const source = `return {
  src = {
    rxbt = cacheSource("RxBt"),
    hspd = cacheSource("HSpd"),
    esc = cacheSource("EscT"),
  }
}`;
    const issues = validatePromptIntent(
      "Rotorflight heli dashboard with headspeed, voltage, ESC temperature cards",
      source,
      { knownSensors: RF_SENSORS, strict: true },
    );
    assert.equal(
      issues.filter((i) => i.severity === "error").length,
      0,
      issues.map((i) => i.message).join("; "),
    );
  });

  it("skips sensors not in the protocol catalog", () => {
    const source = 'cacheSource("RxBt")';
    const issues = validatePromptIntent(
      "Show headspeed and ESC temp",
      source,
      { knownSensors: ["RxBt", "RQLY"], strict: true },
    );
    assert.equal(issues.filter((i) => /headspeed|ESC/i.test(i.message)).length, 0);
  });

  it("warns when large voltage readout lacks DBLSIZE", () => {
    const source = 'cacheSource("RxBt")\nlcd.drawText(0,0,v, MIDSIZE + YELLOW)';
    const issues = validatePromptIntent(
      "Minimal CRSF link and battery widget with large voltage readout, hero style",
      source,
      { knownSensors: ["RxBt", "RQLY"], strict: true },
    );
    assert.ok(issues.some((i) => /DBLSIZE/i.test(i.message)));
  });

  it("requires GPS sats and flight mode when prompted", () => {
    const source = 'cacheSource("RxBt")\ncacheSource("RQLY")';
    const issues = validatePromptIntent(
      "Clean Betaflight dashboard: large battery voltage, link quality bar, GPS sats, flight mode footer",
      source,
      {
        knownSensors: ["RxBt", "RQLY", "Sats", "FM"],
        strict: true,
      },
    );
    assert.ok(issues.some((i) => /GPS satellites/i.test(i.message)));
    assert.ok(issues.some((i) => /flight mode/i.test(i.message)));
  });
});
