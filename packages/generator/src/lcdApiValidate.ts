import type { ValidationIssue } from "@widget-gen/shared";
import {
  PREVIEW_ONLY_COLOR_HINTS,
  PREVIEW_ONLY_COLOR_NAMES,
  stripLuaComments,
} from "./edgeTxLiteralColors.ts";

const DRAW_LINE_PATTERN = /^(SOLID|DOTTED|\d+)$/;

/** Split a Lua argument list on top-level commas. */
export function splitTopLevelArgs(argsSource: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let current = "";

  for (let i = 0; i < argsSource.length; i++) {
    const ch = argsSource[i];

    if (ch === "-" && argsSource[i + 1] === "-") {
      const nl = argsSource.indexOf("\n", i);
      i = nl === -1 ? argsSource.length - 1 : nl;
      continue;
    }

    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < argsSource.length) {
        if (argsSource[j] === "\\") {
          j += 2;
          continue;
        }
        if (argsSource[j] === ch) break;
        j++;
      }
      current += argsSource.slice(i, j + 1);
      i = j;
      continue;
    }

    if (ch === "(") depth++;
    else if (ch === ")") depth--;

    if (ch === "," && depth === 0) {
      args.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  if (current.trim()) args.push(current.trim());
  return args;
}

/** Extract inner argument strings for namespace.<method>(...) calls in source. */
export function extractCallArgStrings(
  source: string,
  prefix: string,
  method: string,
): string[] {
  const calls: string[] = [];
  const needle = `${prefix}.${method}(`;
  let index = 0;

  while (index < source.length) {
    const start = source.indexOf(needle, index);
    if (start === -1) break;

    let i = start + needle.length;
    let depth = 1;
    let argsStart = i;

    while (i < source.length && depth > 0) {
      const ch = source[i];
      if (ch === "-" && source[i + 1] === "-") {
        const nl = source.indexOf("\n", i);
        i = nl === -1 ? source.length : nl + 1;
        continue;
      }
      if (ch === '"' || ch === "'") {
        i = skipQuoted(source, i) + 1;
        continue;
      }
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      i++;
    }

    if (depth === 0) {
      calls.push(source.slice(argsStart, i - 1));
    }
    index = i;
  }

  return calls;
}

/** Extract inner argument strings for lcd.<method>(...) calls in source. */
export function extractLcdCallArgStrings(
  source: string,
  method: string,
): string[] {
  return extractCallArgStrings(source, "lcd", method);
}

function skipQuoted(source: string, start: number): number {
  const quote = source[start];
  let i = start + 1;
  while (i < source.length) {
    if (source[i] === "\\") {
      i += 2;
      continue;
    }
    if (source[i] === quote) return i;
    i++;
  }
  return source.length - 1;
}

function looksLikeColorArg(arg: string): boolean {
  const trimmed = arg.trim();
  if (!trimmed) return false;
  if (DRAW_LINE_PATTERN.test(trimmed)) return false;
  if (
    /^(WHITE|BLACK|GREY|GRAY|RED|GREEN|BLUE|YELLOW|ORANGE|LIGHTGREY|DARKGREY|BRIGHTGREEN|DARKGREEN|DARKBLUE|DARKRED|LIGHTWHITE)$/i.test(
      trimmed,
    )
  ) {
    return true;
  }
  if (/^widget\.C_/.test(trimmed)) return true;
  if (/^lcd\.RGB\s*\(/.test(trimmed)) return true;
  if (
    /^(heroColor|accentCol|linkColor|battColor|armColor|armFill|C_[A-Z_]+)$/.test(
      trimmed,
    )
  )
    return true;
  if (
    /\+/.test(trimmed) &&
    /(WHITE|RIGHT|SMLSIZE|MIDSIZE|DBLSIZE|GREEN|RED|YELLOW|ORANGE|BRIGHTGREEN)/.test(
      trimmed,
    )
  ) {
    return false;
  }
  return true;
}

function looksLikeBitmapPathArg(arg: string): boolean {
  const trimmed = arg.trim();
  if (!trimmed) return false;
  if (/^["']/.test(trimmed)) return true;
  if (/^MODEL_IMG\b/.test(trimmed)) return true;
  if (/_(IMG|PATH)\b/.test(trimmed)) return true;
  if (/^\/[A-Z]/.test(trimmed)) return true;
  return false;
}

/**
 * EdgeTX lcd.drawLine signature: (x1, y1, x2, y2, pattern, [flags]).
 * Color belongs in flags (6th arg), not pattern (5th).
 */
export function validateLcdDrawLineCalls(source: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const argsSource of extractLcdCallArgStrings(source, "drawLine")) {
    const args = splitTopLevelArgs(argsSource);
    if (args.length <= 4) {
      issues.push({
        severity: "error",
        message:
          "lcd.drawLine() requires at least 5 arguments (x1, y1, x2, y2, pattern) — use lcd.drawLine(x1, y1, x2, y2, SOLID, color)",
      });
      continue;
    }

    const patternArg = args[4];
    if (DRAW_LINE_PATTERN.test(patternArg)) continue;

    if (looksLikeColorArg(patternArg)) {
      issues.push({
        severity: "error",
        message:
          "lcd.drawLine() 5th argument must be SOLID or DOTTED (line pattern), not color — use lcd.drawLine(x1, y1, x2, y2, SOLID, colorFlags)",
      });
      continue;
    }

    issues.push({
      severity: "error",
      message:
        "lcd.drawLine() 5th argument must be SOLID or DOTTED — color belongs in the optional 6th flags argument",
    });
  }

  return issues;
}

/**
 * EdgeTX Bitmap.getSize(bitmap) expects the handle from Bitmap.open(), not the SD path string.
 */
export function validateBitmapGetSizeCalls(source: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const argsSource of extractCallArgStrings(source, "Bitmap", "getSize")) {
    const args = splitTopLevelArgs(argsSource);
    if (args.length === 0) continue;

    const firstArg = args[0];
    if (looksLikeBitmapPathArg(firstArg) || args.length > 1) {
      issues.push({
        severity: "error",
        message:
          "Bitmap.getSize() expects the bitmap handle from Bitmap.open(), not the path string — use Bitmap.getSize(modelBmp)",
      });
    }
  }

  return issues;
}

/** EdgeTX global getSize(bitmap) — same handle rule as Bitmap.getSize. */
export function validateGlobalGetSizeCalls(source: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const needle = "getSize(";
  let index = 0;

  while (index < source.length) {
    const start = source.indexOf(needle, index);
    if (start === -1) break;

    const prefix = source.slice(Math.max(0, start - 8), start);
    if (/Bitmap\s*\.\s*$/.test(prefix)) {
      index = start + needle.length;
      continue;
    }

    let i = start + needle.length;
    let depth = 1;
    const argsStart = i;

    while (i < source.length && depth > 0) {
      const ch = source[i];
      if (ch === "-" && source[i + 1] === "-") {
        const nl = source.indexOf("\n", i);
        i = nl === -1 ? source.length : nl + 1;
        continue;
      }
      if (ch === '"' || ch === "'") {
        i = skipQuoted(source, i) + 1;
        continue;
      }
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      i++;
    }

    if (depth === 0) {
      const argsSource = source.slice(argsStart, i - 1);
      const args = splitTopLevelArgs(argsSource);
      if (args.length > 0) {
        const firstArg = args[0];
        if (looksLikeBitmapPathArg(firstArg) || args.length > 1) {
          issues.push({
            severity: "error",
            message:
              "getSize() expects the bitmap handle from Bitmap.open(), not the path string — use Bitmap.getSize(modelBmp)",
          });
        }
      }
    }

    index = start + needle.length;
  }

  return issues;
}

/**
 * Rounded-panel borders: top-left corner arc must use EdgeTX angles 270→360 (0=up),
 * not math/textbook 180→270.
 */
export function validateRoundedPanelArcCalls(
  source: string,
): ValidationIssue[] {
  if (!source.includes("drawFilledCircle") || !source.includes("drawArc")) {
    return [];
  }

  const issues: ValidationIssue[] = [];
  const wrongTopLeft =
    /drawArc\(\s*[^,]+\s*\+\s*\w*cr\w*\s*,\s*[^,]+\s*\+\s*\w*cr\w*\s*,\s*[^,]+\s*,\s*180\s*,\s*270\b/gi;

  for (const match of source.matchAll(wrongTopLeft)) {
    if (match.index === undefined) continue;
    issues.push({
      severity: "error",
      message:
        "drawArc at top-left rounded corner uses math angles (180,270) — EdgeTX uses 0°=up: use drawArc(x+cr, y+cr, cr, 270, 360, color)",
    });
    break;
  }

  return issues;
}

/**
 * drawAnnulus: r1 = inner (smaller), r2 = outer (larger). Swapped radii draw nothing on radio.
 */
export function validateDrawAnnulusRadiusOrder(
  source: string,
): ValidationIssue[] {
  if (!source.includes("drawAnnulus")) return [];

  const issues: ValidationIssue[] = [];

  for (const argsSource of extractCallArgStrings(
    source,
    "lcd",
    "drawAnnulus",
  )) {
    const args = splitTopLevelArgs(argsSource);
    if (args.length < 4) continue;

    const r1 = args[2].trim();
    const r2 = args[3].trim();

    if (/rOut|r_outer|outer/i.test(r1) && /rIn|r_inner|inner/i.test(r2)) {
      issues.push({
        severity: "error",
        message:
          "lcd.drawAnnulus(x, y, r1, r2, ...) — r1 must be inner (smaller), r2 outer (larger); use drawAnnulus(cx, cy, rIn, rOut, ...)",
      });
      break;
    }

    const n1 = Number(r1);
    const n2 = Number(r2);
    if (Number.isFinite(n1) && Number.isFinite(n2) && n1 > n2) {
      issues.push({
        severity: "error",
        message:
          "lcd.drawAnnulus radii appear reversed (first > second) — r1 must be inner radius, r2 outer radius",
      });
      break;
    }
  }

  return issues;
}

/** Reject hardcoded /MODELS/ paths for model bitmaps (images live in /IMAGES/). */
export function validateModelBitmapPath(source: string): ValidationIssue[] {
  if (!source.includes("Bitmap.open") && !source.includes("MODEL_IMG")) {
    return [];
  }

  if (/["']\/MODELS\/[^"']+\.(png|bmp)["']/i.test(source)) {
    return [
      {
        severity: "error",
        message:
          'Model images live in /IMAGES/ — use model.getInfo().bitmap: Bitmap.open("/IMAGES/" .. name); see model-image.md',
      },
    ];
  }

  return [];
}

/** Reject flooring mainH with a literal when gauge + strip share vertical space. */
export function validateMainHLiteralClamp(source: string): ValidationIssue[] {
  if (!source.includes("drawAnnulus")) {
    return [];
  }
  if (!source.includes("stripY") && !source.includes("stripH")) {
    return [];
  }
  if (/if\s+mainH\s*<\s*\d+/.test(source) && /mainH\s*=\s*\d+/.test(source)) {
    return [
      {
        severity: "error",
        message:
          "Do not floor mainH with a literal when gauge+strip layouts share space — shrink rOut via gaugeZoneH() or recompute stripY; see layout-reserved-rects.md",
      },
    ];
  }
  return [];
}

/** Gauge satellite labels at gaugeCy+rOut must be included in layout budget. */
export function validateGaugeSatelliteBudget(
  source: string,
): ValidationIssue[] {
  if (!source.includes("drawAnnulus")) {
    return [];
  }
  const hasSatelliteAnchor =
    /yAmp\w*\s*=/.test(source) || /gaugeCy\s*\+\s*rOut\s*\+/.test(source);
  if (!hasSatelliteAnchor) {
    return [];
  }
  const hasBudget =
    /satelliteBelowH|satelliteBelow|gaugeZoneH|gaugeObstacles/.test(source);
  if (!hasBudget) {
    return [
      {
        severity: "error",
        message:
          "Labels anchored to gaugeCy+rOut must use satelliteBelowH()/gaugeZoneH() in layout budget before stripY — see layout-reserved-rects.md",
      },
    ];
  }
  return [];
}

/** Annulus + strip layouts must plan rects / mainBottom before drawing. */
export function validateGaugeStripLayoutPlanning(
  source: string,
): ValidationIssue[] {
  if (!source.includes("drawAnnulus")) {
    return [];
  }
  if (!source.includes("stripY") && !source.includes("stripH")) {
    return [];
  }
  const hasPlanner =
    /gaugeZoneH|mainBottom|gaugeObstacles|function\s+rect\s*\(/.test(source) ||
    (/local\s+function\s+rect\b/.test(source) && /rectBottom/.test(source));
  if (!hasPlanner) {
    return [
      {
        severity: "error",
        message:
          "Gauge + strip dashboards must compute reserved rects (rect(), mainBottom, or gaugeZoneH) before drawing — see layout-reserved-rects.md",
      },
    ];
  }
  return [];
}

/** Link/battery bar block height must include the last % text row (barsPctY). */
export function validateBarsBlockHeightSync(source: string): ValidationIssue[] {
  if (!source.includes("barsBlockH") && !source.includes("rBars")) {
    return [];
  }
  const hasPctAnchor =
    source.includes("barsPctY") ||
    /trackY\s*\+\s*barH\s*\+\s*LH\.GAP/.test(source) ||
    /drawText\([^)]*,\s*trackY\s*\+\s*barH/.test(source);
  if (!hasPctAnchor) {
    return [];
  }
  const synced =
    /barsBlockH\s*=\s*barsPctY\s*\+/.test(source) ||
    /barsBlockH\s*=\s*[^;\n]*barsPctY[^;\n]*-\s*barsY/.test(source);
  if (!synced) {
    return [
      {
        severity: "error",
        message:
          "barsBlockH must derive from barsPctY (same expression as the last % drawText row) — see layout-reserved-rects.md rule 3",
      },
    ];
  }
  return [];
}

/** Reject fragile #str*charW unit positioning — overlaps on TX15 (no text-width API). */
export function validateUnitSuffixPositioning(
  source: string,
): ValidationIssue[] {
  const suffixMath = /math\.floor\(\s*#\w+\s*\*\s*\d+/;
  const unitOffsetVars = /\w+UnitX\s*=/;

  if (suffixMath.test(source) || unitOffsetVars.test(source)) {
    return [
      {
        severity: "error",
        message:
          "Do not position units with #str*charW or *UnitX variables — use fixed vertical rows (label +16 value +16 unit +18 next label); see tx15-dashboard-ui.md",
      },
    ];
  }

  return [];
}

/** Reject preview-only color globals (LIME, CYAN, MAGENTA, …) that crash on radio. */
export function validateColorConstants(source: string): ValidationIssue[] {
  const stripped = stripLuaComments(source);
  const issues: ValidationIssue[] = [];

  for (const name of PREVIEW_ONLY_COLOR_NAMES) {
    if (new RegExp(`\\b${name}\\b`).test(stripped)) {
      issues.push({
        severity: "error",
        message: `${name} is not an EdgeTX literal color on radio — use ${PREVIEW_ONLY_COLOR_HINTS[name]}`,
      });
    }
  }

  return issues;
}

export function validateRuntimeApiUsage(source: string): ValidationIssue[] {
  return [
    ...validateColorConstants(source),
    ...validateLcdDrawLineCalls(source),
    ...validateBitmapGetSizeCalls(source),
    ...validateGlobalGetSizeCalls(source),
    ...validateRoundedPanelArcCalls(source),
    ...validateDrawAnnulusRadiusOrder(source),
    ...validateModelBitmapPath(source),
    ...validateUnitSuffixPositioning(source),
    ...validateMainHLiteralClamp(source),
    ...validateGaugeSatelliteBudget(source),
    ...validateGaugeStripLayoutPlanning(source),
    ...validateBarsBlockHeightSync(source),
  ];
}

export function validateLcdApiUsage(source: string): ValidationIssue[] {
  return validateRuntimeApiUsage(source);
}
