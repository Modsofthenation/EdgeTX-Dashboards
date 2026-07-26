import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveSimFirmware,
  hasColorWasmSim,
  type SimManifest,
} from "./radioSim/simFirmware.ts";

const SAMPLE_MANIFEST: SimManifest = {
  defaultVersion: "2.11.0",
  versions: {
    "2.11.0": {
      label: "2.11",
      wasm: "edgetx-tx15-2-11-simulator.wasm",
      sha256: "aaa",
      size: 100,
      display: { w: 480, h: 320, depth: 16 },
    },
    "2.12.0": {
      label: "2.12",
      wasm: "edgetx-tx15-2-12-simulator.wasm",
      sha256: "aaa",
      size: 100,
      display: { w: 480, h: 320, depth: 16 },
      aliasOf: "2.11.0",
    },
  },
  radios: {
    tx15: {
      name: "RadioMaster TX15",
      flavour: "tx15",
      wasm: "edgetx-tx15-simulator.wasm",
      size: 100,
      display: { w: 480, h: 320, depth: 16 },
    },
    tx16: {
      name: "RadioMaster TX16S",
      flavour: "tx16s",
      wasm: "edgetx-tx16s-simulator.wasm",
      size: 200,
      display: { w: 480, h: 272, depth: 16 },
    },
  },
};

describe("resolveSimFirmware", () => {
  it("maps 2.12.0 to its wasm entry for TX15", () => {
    const resolved = resolveSimFirmware(SAMPLE_MANIFEST, "2.12.0", "tx15");
    assert.equal(resolved.wasmUrl, "/sim/edgetx-tx15-2-11-simulator.wasm");
    assert.equal(resolved.label, "2.12");
    assert.equal(resolved.aliasOf, "2.11.0");
    assert.equal(resolved.radioKey, "tx15");
  });

  it("falls back to default for unknown versions on TX15", () => {
    const resolved = resolveSimFirmware(SAMPLE_MANIFEST, "2.10.0", "tx15");
    assert.equal(resolved.wasmUrl, "/sim/edgetx-tx15-2-11-simulator.wasm");
    assert.equal(resolved.fallback, true);
  });

  it("resolves TX16S from radios map with tx16s radioKey", () => {
    const resolved = resolveSimFirmware(SAMPLE_MANIFEST, "2.11.0", "tx16");
    assert.equal(resolved.wasmUrl, "/sim/edgetx-tx16s-simulator.wasm");
    assert.equal(resolved.radioKey, "tx16s");
    assert.equal(resolved.radioId, "tx16");
    assert.equal(resolved.display?.h, 272);
  });
});

describe("hasColorWasmSim", () => {
  it("includes color and B&W WASM radios", () => {
    assert.equal(hasColorWasmSim("tx15"), true);
    assert.equal(hasColorWasmSim("tx16"), true);
    assert.equal(hasColorWasmSim("t16"), true);
    assert.equal(hasColorWasmSim("boxer"), true);
    assert.equal(hasColorWasmSim("mt12"), true);
  });
});
