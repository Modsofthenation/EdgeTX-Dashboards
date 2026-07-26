import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  companionFilesToSd,
  getCompanionSuite,
  addCompanionSuite,
} from "./companionSuites.ts";

describe("companionSuites", () => {
  it("maps tools/telemetry paths to SD SCRIPTS/", () => {
    const suite = getCompanionSuite("flight-logger");
    assert.ok(suite);
    const sd = companionFilesToSd(suite.files);
    assert.deepEqual(
      sd.map((f) => f.path).sort(),
      ["SCRIPTS/TELEMETRY/flight_log.lua", "SCRIPTS/TOOLS/log_view.lua"].sort(),
    );
  });

  it("merges suites idempotently by relPath", () => {
    let state = addCompanionSuite({ suites: [], files: [] }, "batt-select");
    state = addCompanionSuite(state, "batt-select");
    assert.equal(state.suites.length, 1);
    assert.equal(state.files.length, 1);
    state = addCompanionSuite(state, "flights-count");
    assert.equal(state.suites.length, 2);
    assert.equal(state.files.length, 2);
  });

  it("exposes batt-voice and motor-gate suites", () => {
    assert.ok(getCompanionSuite("batt-voice"));
    assert.ok(getCompanionSuite("motor-gate"));
    const sd = companionFilesToSd([
      ...getCompanionSuite("batt-voice")!.files,
      ...getCompanionSuite("motor-gate")!.files,
    ]);
    assert.ok(sd.some((f) => f.path.includes("batt_voice.lua")));
    assert.ok(sd.some((f) => f.path.includes("motor_gate.lua")));
  });
});
