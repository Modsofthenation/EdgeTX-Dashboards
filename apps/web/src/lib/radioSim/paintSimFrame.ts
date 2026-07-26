import {
  cropZoneFromFramebuffer,
  gray4ToImageData,
  mono1ToImageData,
  rgb565ToImageData,
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

function frameToImageData(
  cropped: Uint8Array,
  width: number,
  height: number,
  depth: number,
): ImageData | null {
  if (depth === 16) return rgb565ToImageData(cropped, width, height);
  if (depth === 1) return mono1ToImageData(cropped, width, height);
  if (depth === 4) return gray4ToImageData(cropped, width, height);
  return null;
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

  const data = new Uint8Array(frame.buffer);
  const cropped = cropZoneFromFramebuffer(
    data,
    frame.width,
    frame.height,
    frame.depth,
    zone.zoneX,
    zone.zoneY,
    zone.zoneW,
    zone.zoneH,
  );

  const image = frameToImageData(cropped, zone.zoneW, zone.zoneH, frame.depth);
  if (!image) return false;

  scratchCanvas.width = zone.zoneW;
  scratchCanvas.height = zone.zoneH;
  const scratchCtx = scratchCanvas.getContext("2d");
  if (!scratchCtx) return false;

  scratchCtx.putImageData(image, 0, 0);

  targetCtx.imageSmoothingEnabled = false;
  targetCtx.clearRect(0, 0, targetWidth, targetHeight);
  targetCtx.drawImage(scratchCanvas, 0, 0, targetWidth, targetHeight);
  return true;
}
