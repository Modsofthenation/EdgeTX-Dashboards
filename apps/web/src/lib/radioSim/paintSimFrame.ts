import {
  cropZoneFromFramebuffer,
  gray4ToImageData,
  mono1ToImageData,
  type SimFrameData,
} from "@widget-gen/sim-preview";

export interface SimFrameZone {
  zoneX: number;
  zoneY: number;
  zoneW: number;
  zoneH: number;
}

export interface PaintSimFrameOptions {
  frame: SimFrameData;
  zone: SimFrameZone;
  targetCtx: CanvasRenderingContext2D;
  targetWidth: number;
  targetHeight: number;
  scratchCanvas: HTMLCanvasElement;
}

type ScratchState = {
  ctx: CanvasRenderingContext2D;
  rgba: Uint8ClampedArray<ArrayBuffer> | null;
  rgbaW: number;
  rgbaH: number;
  crop: Uint8Array | null;
  cropLen: number;
};

const scratchState = new WeakMap<HTMLCanvasElement, ScratchState>();

function getScratchState(
  scratchCanvas: HTMLCanvasElement,
): ScratchState | null {
  const existing = scratchState.get(scratchCanvas);
  if (existing) return existing;
  const ctx = scratchCanvas.getContext("2d");
  if (!ctx) return null;
  const state: ScratchState = {
    ctx,
    rgba: null,
    rgbaW: 0,
    rgbaH: 0,
    crop: null,
    cropLen: 0,
  };
  scratchState.set(scratchCanvas, state);
  return state;
}

function ensureRgba(
  state: ScratchState,
  width: number,
  height: number,
): Uint8ClampedArray<ArrayBuffer> {
  const len = width * height * 4;
  if (!state.rgba || state.rgba.length < len) {
    state.rgba = new Uint8ClampedArray(new ArrayBuffer(len));
  }
  state.rgbaW = width;
  state.rgbaH = height;
  return state.rgba.subarray(0, len) as Uint8ClampedArray<ArrayBuffer>;
}

function ensureCrop(state: ScratchState, byteLen: number): Uint8Array {
  if (!state.crop || state.crop.length < byteLen) {
    state.crop = new Uint8Array(byteLen);
  }
  state.cropLen = byteLen;
  return state.crop.subarray(0, byteLen);
}

function frameToImageDataInto(
  cropped: Uint8Array,
  width: number,
  height: number,
  depth: number,
  rgba: Uint8ClampedArray<ArrayBuffer>,
): ImageData | null {
  if (depth === 16) {
    // rgb565ToImageData allocates; write into reused buffer instead.
    let si = 0;
    for (let i = 0; i < width * height; i++) {
      const lo = cropped[si++]!;
      const hi = cropped[si++]!;
      const rgb565 = lo | (hi << 8);
      const r = (((rgb565 >> 11) & 0x1f) * 255) / 31;
      const g = (((rgb565 >> 5) & 0x3f) * 255) / 63;
      const b = ((rgb565 & 0x1f) * 255) / 31;
      const o = i * 4;
      rgba[o] = r;
      rgba[o + 1] = g;
      rgba[o + 2] = b;
      rgba[o + 3] = 255;
    }
    return new ImageData(rgba, width, height);
  }
  if (depth === 1) {
    const image = mono1ToImageData(cropped, width, height);
    rgba.set(image.data);
    return new ImageData(rgba, width, height);
  }
  if (depth === 4) {
    const image = gray4ToImageData(cropped, width, height);
    rgba.set(image.data);
    return new ImageData(rgba, width, height);
  }
  return null;
}

function packedCropByteLen(
  zoneW: number,
  zoneH: number,
  depth: number,
): number {
  if (depth === 1) return zoneW * ((zoneH + 7) >> 3);
  if (depth === 4) return (zoneW * zoneH * 4) >> 3;
  return zoneW * zoneH * (depth >> 3);
}

/** Paint a cropped WASM LCD frame into a display canvas (1 / 4 / 16-bit). */
export function paintSimFrame({
  frame,
  zone,
  targetCtx,
  targetWidth,
  targetHeight,
  scratchCanvas,
}: PaintSimFrameOptions): boolean {
  if (frame.depth !== 16 && frame.depth !== 1 && frame.depth !== 4) {
    return false;
  }

  const scratch = getScratchState(scratchCanvas);
  if (!scratch) return false;

  const data = new Uint8Array(frame.buffer);
  const fullFrame =
    zone.zoneX === 0 &&
    zone.zoneY === 0 &&
    zone.zoneW === frame.width &&
    zone.zoneH === frame.height;

  let cropped: Uint8Array;
  if (fullFrame) {
    // Avoid allocating a copy of the full LCD buffer.
    cropped = data;
  } else {
    const cropLen = packedCropByteLen(zone.zoneW, zone.zoneH, frame.depth);
    const cropBuf = ensureCrop(scratch, cropLen);
    const fresh = cropZoneFromFramebuffer(
      data,
      frame.width,
      frame.height,
      frame.depth,
      zone.zoneX,
      zone.zoneY,
      zone.zoneW,
      zone.zoneH,
    );
    cropBuf.set(fresh);
    cropped = cropBuf;
  }

  const rgba = ensureRgba(scratch, zone.zoneW, zone.zoneH);
  const image = frameToImageDataInto(
    cropped,
    zone.zoneW,
    zone.zoneH,
    frame.depth,
    rgba,
  );
  if (!image) return false;

  // Only reset backing store when dimensions change (clears the canvas).
  if (scratchCanvas.width !== zone.zoneW) scratchCanvas.width = zone.zoneW;
  if (scratchCanvas.height !== zone.zoneH) scratchCanvas.height = zone.zoneH;

  scratch.ctx.putImageData(image, 0, 0);

  targetCtx.imageSmoothingEnabled = false;
  targetCtx.clearRect(0, 0, targetWidth, targetHeight);
  targetCtx.drawImage(scratchCanvas, 0, 0, targetWidth, targetHeight);
  return true;
}
