import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BASE_MOCK,
  getMockForSensor,
  mergeLiveIntoMock,
  resolveMockSensorKey,
} from "./mockTelemetry.ts";

describe("mockTelemetry aliases", () => {
  it("resolves Discover / radio aliases", () => {
    assert.equal(resolveMockSensorKey("Hspd"), "HSpd");
    assert.equal(resolveMockSensorKey("Tesc"), "EscT");
    assert.equal(resolveMockSensorKey("NR"), "HSpd");
    assert.equal(resolveMockSensorKey("RQly"), "RQLY");
    assert.equal(resolveMockSensorKey("unknown"), null);
  });

  it("getMockForSensor follows aliases", () => {
    assert.equal(getMockForSensor("Hspd", BASE_MOCK), BASE_MOCK.HSpd);
    assert.equal(getMockForSensor("Tesc", BASE_MOCK), BASE_MOCK.EscT);
  });

  it("mergeLiveIntoMock overlays known + aliased sensors", () => {
    const merged = mergeLiveIntoMock(BASE_MOCK, {
      RQLY: 44,
      Hspd: 2100,
      Tesc: 55,
      FM: "HOLD",
      Mystery: 9,
    });
    assert.equal(merged.RQLY, 44);
    assert.equal(merged.HSpd, 2100);
    assert.equal(merged.EscT, 55);
    assert.equal(merged.FM, "HOLD");
    assert.equal(merged.Curr, BASE_MOCK.Curr);
  });
});
