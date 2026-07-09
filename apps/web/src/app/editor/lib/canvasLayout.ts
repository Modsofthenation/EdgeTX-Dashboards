export interface CanvasLayout {
  scale: number;
  offsetX: number;
  offsetY: number;
  drawW: number;
  drawH: number;
  zoneW: number;
  zoneH: number;
}

/** Shared layout math for canvas paint + selection overlay — must stay in sync. */
export function computeCanvasLayout(
  frameWidth: number,
  frameHeight: number,
  zoneW: number,
  zoneH: number
): CanvasLayout {
  const scale = Math.min(frameWidth / zoneW, frameHeight / zoneH);
  const drawW = zoneW * scale;
  const drawH = zoneH * scale;
  const offsetX = (frameWidth - drawW) / 2;
  const offsetY = (frameHeight - drawH) / 2;
  return { scale, offsetX, offsetY, drawW, drawH, zoneW, zoneH };
}
