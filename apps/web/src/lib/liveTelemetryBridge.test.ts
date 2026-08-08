import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  enrichRotorflightLiveSensors,
  listEnrichOnlyKeys,
  partitionLiveSensorKeys,
  ROTORFLIGHT_ENRICH_KEYS,
  shallowEqualLiveSensorMaps,
} from "./liveTelemetryBridge.ts";

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

describe("partitionLiveSensorKeys", () => {
  it("separates wire keys from enrich-only RF keys", () => {
    const wire = { RxBt: 16.2, RQLY: 95, FM: "NORM" };
    const enriched = enrichRotorflightLiveSensors(wire);
    const { wireKeys, enrichKeys } = partitionLiveSensorKeys(wire, enriched);
    assert.deepEqual(wireKeys, ["FM", "RQLY", "RxBt"]);
    assert.ok(enrichKeys.includes("HSpd"));
    assert.ok(enrichKeys.includes("Gov"));
    assert.ok(enrichKeys.includes("Vbec"));
    assert.ok(!enrichKeys.includes("RxBt"));
  });

  it("does not mark wire-present RF keys as enrich-only", () => {
    const wire = { RxBt: 16, HSpd: 2000, Gov: 3 };
    const enriched = enrichRotorflightLiveSensors(wire);
    const { wireKeys, enrichKeys } = partitionLiveSensorKeys(wire, enriched);
    assert.ok(wireKeys.includes("HSpd"));
    assert.ok(wireKeys.includes("Gov"));
    assert.ok(!enrichKeys.includes("HSpd"));
    assert.ok(!enrichKeys.includes("Gov"));
  });
});

describe("listEnrichOnlyKeys", () => {
  it("returns empty when enrich is off", () => {
    assert.deepEqual(listEnrichOnlyKeys({ HSpd: 1, Vbec: 8 }, false), []);
  });

  it("returns ROTORFLIGHT_ENRICH_KEYS present when enrich is on", () => {
    const keys = listEnrichOnlyKeys(
      { HSpd: 1800, RxBt: 16, Vbec: 8.2, RQLY: 90 },
      true,
    );
    assert.deepEqual(keys, ["HSpd", "Vbec"]);
    for (const k of keys) {
      assert.ok((ROTORFLIGHT_ENRICH_KEYS as readonly string[]).includes(k));
    }
  });
});

describe("shallowEqualLiveSensorMaps", () => {
  it("compares keys and primitive values", () => {
    assert.equal(
      shallowEqualLiveSensorMaps({ a: 1, b: "x" }, { a: 1, b: "x" }),
      true,
    );
    assert.equal(shallowEqualLiveSensorMaps({ a: 1 }, { a: 1, b: 2 }), false);
    assert.equal(shallowEqualLiveSensorMaps({ a: 1 }, { a: 2 }), false);
  });
});
