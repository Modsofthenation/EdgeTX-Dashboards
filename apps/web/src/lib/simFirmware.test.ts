import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveSimFirmware,
  type SimManifest,
} from "./radioSim/simFirmware.ts";

const SAMPLE_MANIFEST: SimManifest = {
  defaultVersion: "2.11.0",
  versions: {
    "2.11.0": {
      label: "2.11",
      wasm: "edgetx-tx15-2.11-simulator.wasm",
      sha256: "aaa",
      size: 100,
      display: { w: 480, h: 320, depth: 16 },
    },
    "2.12.0": {
      label: "2.12",
      wasm: "edgetx-tx15-2.12-simulator.wasm",
      sha256: "aaa",
      size: 100,
      display: { w: 480, h: 320, depth: 16 },
      aliasOf: "2.11.0",
    },
  },
};

describe("resolveSimFirmware", () => {
  it("maps 2.12.0 to its wasm entry", () => {
    const resolved = resolveSimFirmware(SAMPLE_MANIFEST, "2.12.0");
    assert.equal(resolved.wasmUrl, "/sim/edgetx-tx15-2.11-simulator.wasm");
    assert.equal(resolved.label, "2.12");
    assert.equal(resolved.aliasOf, "2.11.0");
  });

  it("falls back to default for unknown versions", () => {
    const resolved = resolveSimFirmware(SAMPLE_MANIFEST, "2.10.0");
    assert.equal(resolved.wasmUrl, "/sim/edgetx-tx15-2.11-simulator.wasm");
    assert.equal(resolved.fallback, true);
  });
});
