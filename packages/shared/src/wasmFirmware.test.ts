import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COLOR_WASM_RADIOS,
  getColorWasmRadio,
  hasColorWasmSim,
  wasmFileForFlavour,
} from "./wasmFirmware.ts";

describe("wasmFirmware color catalog", () => {
  it("covers TX15 + matching 480×272 color targets", () => {
    assert.ok(COLOR_WASM_RADIOS.some((r) => r.id === "tx15"));
    assert.ok(COLOR_WASM_RADIOS.some((r) => r.id === "tx16"));
    assert.ok(COLOR_WASM_RADIOS.every((r) => r.depth === 16));
  });

  it("maps knowledge ids to EdgeTX flavours", () => {
    assert.equal(getColorWasmRadio("tx16")?.flavour, "tx16s");
    assert.equal(getColorWasmRadio("x12")?.flavour, "x12s");
    assert.equal(wasmFileForFlavour("tx16s"), "edgetx-tx16s-simulator.wasm");
  });

  it("excludes B&W / mismatched radios from color WASM gate", () => {
    assert.equal(hasColorWasmSim("boxer"), false);
    assert.equal(hasColorWasmSim("mt12"), false);
    assert.equal(hasColorWasmSim("nv14"), false);
    assert.equal(hasColorWasmSim("x18"), false);
  });
});
