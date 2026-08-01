import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertFidelityGates,
  compareRgbaBitmaps,
  downscaleNearest,
  FIDELITY_GATES,
  type RgbaBitmap,
} from "./previewCompare.ts";

function solid(
  w: number,
  h: number,
  r: number,
  g: number,
  b: number,
): RgbaBitmap {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    data[o] = r;
    data[o + 1] = g;
    data[o + 2] = b;
    data[o + 3] = 255;
  }
  return { width: w, height: h, data };
}

describe("previewCompare", () => {
  it("identical bitmaps pass fidelity gates", () => {
    const a = solid(80, 60, 64, 64, 64);
    const metrics = compareRgbaBitmaps(a, a, { compareW: 40, compareH: 30 });
    assert.equal(metrics.mae, 0);
    assert.equal(metrics.hardMismatchRatio, 0);
    assert.ok(metrics.histCorrelation > 0.99);
    assert.deepEqual(assertFidelityGates(metrics), []);
  });

  it("near colors stay under gates", () => {
    const a = solid(80, 60, 64, 64, 64);
    const b = solid(80, 60, 72, 70, 66);
    const metrics = compareRgbaBitmaps(a, b, { compareW: 40, compareH: 30 });
    assert.ok(metrics.mae < 20);
    assert.deepEqual(assertFidelityGates(metrics), []);
  });

  it("grossly different palettes fail gates", () => {
    const a = solid(80, 60, 0, 0, 0);
    const b = solid(80, 60, 255, 255, 0);
    const metrics = compareRgbaBitmaps(a, b, { compareW: 40, compareH: 30 });
    const fails = assertFidelityGates(metrics, {
      ...FIDELITY_GATES,
      maxMae: 20,
      maxHardMismatchRatio: 0.1,
      minHistCorrelation: 0.9,
      maxCoverageDelta: 0.05,
    });
    assert.ok(fails.length > 0);
  });

  it("downscaleNearest preserves corners", () => {
    const src = solid(10, 10, 0, 0, 0);
    src.data[0] = 255;
    src.data[1] = 0;
    src.data[2] = 0;
    const out = downscaleNearest(src, 5, 5);
    assert.equal(out.data[0], 255);
  });
});
