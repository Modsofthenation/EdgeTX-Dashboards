import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BASE_MOCK } from "@widget-gen/layout-verify";
import { BASE_MOCK_TELEMETRY } from "./telemetryBridge.ts";

describe("BASE_MOCK_TELEMETRY", () => {
  it("matches layout-verify BASE_MOCK (single SoT)", () => {
    assert.deepEqual(BASE_MOCK_TELEMETRY, BASE_MOCK);
    assert.equal(BASE_MOCK_TELEMETRY.Vbat, BASE_MOCK.Vbat);
    assert.equal(BASE_MOCK_TELEMETRY.Gov, BASE_MOCK.Gov);
  });
});
