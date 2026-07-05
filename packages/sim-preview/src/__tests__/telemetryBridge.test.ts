import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildTelemetryFrames, BASE_MOCK_TELEMETRY } from "../telemetryBridge.js";

describe("telemetryBridge", () => {
  it("builds CRSF frames for BASE_MOCK", () => {
    const frames = buildTelemetryFrames(BASE_MOCK_TELEMETRY);
    assert.equal(frames.length, 6);

    const link = frames[0];
    assert.equal(link[0], 0xc8);
    assert.equal(link[2], 0x14);
    assert.equal(link[5], 92);

    const battery = frames[1];
    assert.equal(battery[2], 0x08);
    const voltage = (battery[3] << 8) | battery[4];
    assert.equal(voltage, 162);

    const flightMode = frames[4];
    assert.equal(flightMode[2], 0x21);
    const modeText = String.fromCharCode(...flightMode.slice(3)).replace(/\0/g, "");
    assert.equal(modeText, "Stab");
  });

  it("maps RxBt 16.2V to CRSF decivolts", () => {
    const frames = buildTelemetryFrames({ ...BASE_MOCK_TELEMETRY, RxBt: 16.2 });
    const battery = frames[1];
    const voltage = (battery[3] << 8) | battery[4];
    assert.equal(voltage, 162);
  });
});
