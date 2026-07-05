import {
  cropZoneFromFramebuffer,
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

/** Paint a cropped WASM LCD frame into a display canvas (RGB565 firmware). */
export function paintSimFrame({
  frame,
  zone,
  targetCtx,
  targetWidth,
  targetHeight,
  scratchCanvas,
}: PaintSimFrameOptions): boolean {
  if (frame.depth !== 16) return false;

  const data = new Uint8Array(frame.buffer);
  const cropped = cropZoneFromFramebuffer(
    data,
    frame.width,
    frame.height,
    frame.depth,
    zone.zoneX,
    zone.zoneY,
    zone.zoneW,
    zone.zoneH
  );

  scratchCanvas.width = zone.zoneW;
  scratchCanvas.height = zone.zoneH;
  const scratchCtx = scratchCanvas.getContext("2d");
  if (!scratchCtx) return false;

  scratchCtx.putImageData(rgb565ToImageData(cropped, zone.zoneW, zone.zoneH), 0, 0);

  targetCtx.imageSmoothingEnabled = false;
  targetCtx.clearRect(0, 0, targetWidth, targetHeight);
  targetCtx.drawImage(scratchCanvas, 0, 0, targetWidth, targetHeight);
  return true;
}
