/** Shared contract for drawable lcd.* calls inside refresh(). */

export interface DrawSurfaceAnalysis {
  refreshBody: string;
  drawTextCount: number;
  hasFilledRectangle: boolean;
  filledRectangleCount: number;
  hasSmlSize: boolean;
  hasDblSize: boolean;
  stackedTopLeftWithoutPanels: boolean;
}

const REFRESH_SIG = /local\s+function\s+refresh\s*\([^)]*\)/;
const BLOCK_OPEN = new Set(["function", "if", "for", "while", "repeat"]);

/** Extract the body of `local function refresh(...) ... end`, balancing nested blocks. */
export function extractRefreshBody(source: string): string {
  const sigMatch = source.match(REFRESH_SIG);
  if (!sigMatch || sigMatch.index === undefined) return source;

  const bodyStart = sigMatch.index + sigMatch[0].length;
  const bodyEnd = findBalancedFunctionEnd(source, bodyStart);
  return source.slice(bodyStart, bodyEnd).trim();
}

function findBalancedFunctionEnd(source: string, bodyStart: number): number {
  let depth = 1;
  let i = bodyStart;

  while (i < source.length && depth > 0) {
    const ch = source[i];

    if (ch === "-" && source[i + 1] === "-") {
      const nl = source.indexOf("\n", i);
      i = nl === -1 ? source.length : nl + 1;
      continue;
    }

    if (ch === '"' || ch === "'") {
      i = skipLuaString(source, i);
      continue;
    }

    const word = readWord(source, i);
    if (word) {
      if (BLOCK_OPEN.has(word)) depth++;
      else if (word === "end" || word === "until") depth--;
      i += word.length;
      continue;
    }

    i++;
  }

  return depth === 0 ? i - 3 : source.length;
}

function readWord(source: string, index: number): string | null {
  const m = source.slice(index).match(/^[A-Za-z_]\w*/);
  return m ? m[0] : null;
}

function skipLuaString(source: string, start: number): number {
  const quote = source[start];
  let i = start + 1;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === quote) return i + 1;
    i++;
  }
  return source.length;
}

/** Analyze drawable surface in refresh() — used by validator and preview. */
export function analyzeDrawSurface(source: string): DrawSurfaceAnalysis {
  const refreshBody = extractRefreshBody(source);
  const drawTextCount = (refreshBody.match(/lcd\.drawText/g) ?? []).length;
  const filledRectangleCount = (refreshBody.match(/lcd\.drawFilledRectangle/g) ?? []).length;
  const hasFilledRectangle = filledRectangleCount > 0;
  const hasSmlSize = /SMLSIZE/.test(refreshBody);
  const hasDblSize = /DBLSIZE/.test(refreshBody);
  const stackedTopLeftWithoutPanels =
    /lcd\.drawText\s*\(\s*4\s*,\s*4/.test(refreshBody) &&
    drawTextCount >= 5 &&
    !/DARKGREY|GREY/.test(refreshBody);

  return {
    refreshBody,
    drawTextCount,
    hasFilledRectangle,
    filledRectangleCount,
    hasSmlSize,
    hasDblSize,
    stackedTopLeftWithoutPanels,
  };
}
