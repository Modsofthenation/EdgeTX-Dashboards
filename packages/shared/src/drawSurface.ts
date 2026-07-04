/** Shared contract for drawable lcd.* calls inside refresh(). */

export interface DrawSurfaceAnalysis {
  refreshBody: string;
  drawTextCount: number;
  hasFilledRectangle: boolean;
  hasSmlSize: boolean;
  stackedTopLeftWithoutPanels: boolean;
}

/** Extract the body of `local function refresh(...) ... end`. */
export function extractRefreshBody(source: string): string {
  const match = source.match(/local function refresh[\s\S]*?\n([\s\S]*?)\nend/);
  return match?.[1] ?? source;
}

/** Analyze drawable surface in refresh() — used by validator and preview. */
export function analyzeDrawSurface(source: string): DrawSurfaceAnalysis {
  const refreshBody = extractRefreshBody(source);
  const drawTextCount = (refreshBody.match(/lcd\.drawText/g) ?? []).length;
  const hasFilledRectangle = /lcd\.drawFilledRectangle/.test(refreshBody);
  const hasSmlSize = /SMLSIZE/.test(refreshBody);
  const stackedTopLeftWithoutPanels =
    /lcd\.drawText\s*\(\s*4\s*,\s*4/.test(refreshBody) &&
    drawTextCount >= 5 &&
    !/DARKGREY|GREY/.test(refreshBody);

  return {
    refreshBody,
    drawTextCount,
    hasFilledRectangle,
    hasSmlSize,
    stackedTopLeftWithoutPanels,
  };
}
