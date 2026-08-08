import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COLOR_WASM_RADIOS,
  WASM_RADIOS,
  getWasmRadio,
  hasColorWasmSim,
  hasWasmSim,
  wasmFileForFlavour,
} from "./wasmFirmware.ts";

describe("wasmFirmware catalog", () => {
  it("covers TX15 + color + B&W targets", () => {
    assert.ok(WASM_RADIOS.some((r) => r.id === "tx15"));
    assert.ok(WASM_RADIOS.some((r) => r.id === "tx16"));
    assert.ok(WASM_RADIOS.some((r) => r.id === "boxer" && r.depth === 1));
    assert.ok(WASM_RADIOS.some((r) => r.id === "mt12" && r.depth === 1));
    assert.ok(WASM_RADIOS.some((r) => r.id === "nv14" && r.depth === 16));
    assert.ok(COLOR_WASM_RADIOS.every((r) => r.depth === 16));
  });

  it("maps knowledge ids to EdgeTX flavours", () => {
    assert.equal(getWasmRadio("tx16")?.flavour, "tx16s");
    assert.equal(getWasmRadio("x12")?.flavour, "x12s");
    assert.equal(getWasmRadio("tx12")?.flavour, "tx12mk2");
    assert.equal(getWasmRadio("x7")?.flavour, "x7access");
    assert.equal(wasmFileForFlavour("tx16s"), "edgetx-tx16s-simulator.wasm");
  });

  it("gates WASM sim for catalogued radios including B&W", () => {
    assert.equal(hasWasmSim("boxer"), true);
    assert.equal(hasWasmSim("mt12"), true);
    assert.equal(hasWasmSim("nv14"), true);
    assert.equal(hasWasmSim("x18"), false);
    assert.equal(hasColorWasmSim("zorro"), true);
  });
});
