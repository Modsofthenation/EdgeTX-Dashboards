export interface CanvasLayout {
  scale: number;
  offsetX: number;
  offsetY: number;
  drawW: number;
  drawH: number;
  zoneW: number;
  zoneH: number;
  /** User zoom multiplier on top of fit-to-frame (1 = fit). */
  zoom: number;
}

export type CanvasViewTransform = {
  zoom?: number;
  panX?: number;
  panY?: number;
};

/** Shared layout math for canvas paint + selection overlay — must stay in sync. */
export function computeCanvasLayout(
  frameWidth: number,
  frameHeight: number,
  zoneW: number,
  zoneH: number,
  view?: CanvasViewTransform,
): CanvasLayout {
  const zoom = Math.min(4, Math.max(0.25, view?.zoom ?? 1));
  const panX = view?.panX ?? 0;
  const panY = view?.panY ?? 0;
  const fit = Math.min(frameWidth / zoneW, frameHeight / zoneH);
  const scale = fit * zoom;
  const drawW = zoneW * scale;
  const drawH = zoneH * scale;
  const offsetX = (frameWidth - drawW) / 2 + panX;
  const offsetY = (frameHeight - drawH) / 2 + panY;
  return { scale, offsetX, offsetY, drawW, drawH, zoneW, zoneH, zoom };
}
