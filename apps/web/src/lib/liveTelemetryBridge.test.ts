import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enrichRotorflightLiveSensors } from "./liveTelemetryBridge.ts";

describe("enrichRotorflightLiveSensors", () => {
  it("fills RF heli RF sensors from pack voltage", () => {
    const out = enrichRotorflightLiveSensors({
      RxBt: 22.2,
      FM: "HOLD",
      RQLY: 90,
    });
    assert.equal(out.Vbat, 22.2);
    assert.ok(typeof out.Vcel === "number" && out.Vcel > 3);
    assert.ok(typeof out.Vbec === "number");
    assert.ok(typeof out.HSpd === "number" && out.HSpd > 0);
    assert.ok(typeof out.Tspd === "number");
    assert.equal(out.Gov, 0);
    assert.equal(out.RQLY, 90);
  });

  it("does not overwrite live RF keys already present", () => {
    const out = enrichRotorflightLiveSensors({
      RxBt: 16,
      HSpd: 2000,
      Vbec: 7.9,
      Gov: 1,
    });
    assert.equal(out.HSpd, 2000);
    assert.equal(out.Vbec, 7.9);
    assert.equal(out.Gov, 1);
  });
});
