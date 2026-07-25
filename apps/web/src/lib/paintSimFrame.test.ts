import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { rgb565ToImageData } from "@widget-gen/sim-preview";
import { paintSimFrame } from "./radioSim/paintSimFrame.ts";

before(() => {
  if (typeof globalThis.ImageData === "undefined") {
    globalThis.ImageData = class ImageData {
      data: Uint8ClampedArray;
      width: number;
      height: number;
      constructor(data: Uint8ClampedArray, width: number, height?: number) {
        this.data = data;
        this.width = width;
        this.height = height ?? data.length / (4 * width);
      }
    } as unknown as typeof ImageData;
  }
});

function createMockCanvas(width: number, height: number) {
  const image = new Uint8ClampedArray(width * height * 4);
  const ctx = {
    imageSmoothingEnabled: false,
    clearRect: () => {},
    drawImage: () => {},
    putImageData: (data: ImageData) => {
      image.set(data.data);
    },
    getImageData: () => ({ data: image, width, height }),
  };
  return { canvas: { width, height }, ctx };
}

describe("paintSimFrame", () => {
  it("crops zone and scales to target canvas", () => {
    const zoneW = 4;
    const zoneH = 2;
    const lcdW = 8;
    const lcdH = 2;

    const full = new Uint8Array(lcdW * lcdH * 2);
    for (let y = 0; y < lcdH; y++) {
      for (let x = 0; x < lcdW; x++) {
        const rgb565 = x === 0 ? 0xf800 : 0x001f;
        const i = (y * lcdW + x) * 2;
        full[i] = rgb565 & 0xff;
        full[i + 1] = (rgb565 >> 8) & 0xff;
      }
    }

    const { ctx: targetCtx } = createMockCanvas(zoneW, zoneH);
    const scratch = {
      width: 0,
      height: 0,
      getContext: () => ({
        putImageData: () => {},
      }),
    } as unknown as HTMLCanvasElement;

    const ok = paintSimFrame({
      frame: { buffer: full.buffer, width: lcdW, height: lcdH, depth: 16 },
      zone: { zoneX: 2, zoneY: 0, zoneW, zoneH },
      targetCtx: targetCtx as unknown as CanvasRenderingContext2D,
      targetWidth: zoneW,
      targetHeight: zoneH,
      scratchCanvas: scratch,
    });

    assert.equal(ok, true);
  });

  it("returns false for unsupported bit depth", () => {
    const { ctx: targetCtx } = createMockCanvas(1, 1);
    const scratch = {
      width: 0,
      height: 0,
      getContext: () => null,
    } as unknown as HTMLCanvasElement;

    const ok = paintSimFrame({
      frame: { buffer: new ArrayBuffer(4), width: 1, height: 1, depth: 32 },
      zone: { zoneX: 0, zoneY: 0, zoneW: 1, zoneH: 1 },
      targetCtx: targetCtx as unknown as CanvasRenderingContext2D,
      targetWidth: 1,
      targetHeight: 1,
      scratchCanvas: scratch,
    });

    assert.equal(ok, false);
  });
});

describe("rgb565ToImageData", () => {
  it("decodes red pixel", () => {
    const data = new Uint8Array([0x00, 0xf8]);
    const image = rgb565ToImageData(data, 1, 1);
    assert.equal(image.data[0], 255);
    assert.equal(image.data[1], 0);
    assert.equal(image.data[2], 0);
  });
});
