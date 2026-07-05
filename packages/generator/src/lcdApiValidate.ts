import type { ValidationIssue } from "@widget-gen/shared";

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
export function extractCallArgStrings(source: string, prefix: string, method: string): string[] {
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
export function extractLcdCallArgStrings(source: string, method: string): string[] {
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
  if (/^(WHITE|BLACK|GREY|GRAY|RED|GREEN|BLUE|CYAN|YELLOW|ORANGE|MAGENTA|LIME|LIGHTGREY|DARKGREY)$/i.test(trimmed)) {
    return true;
  }
  if (/^widget\.C_/.test(trimmed)) return true;
  if (/^lcd\.RGB\s*\(/.test(trimmed)) return true;
  if (/^(heroColor|accentCol|linkColor|battColor|armColor|armFill|C_[A-Z_]+)$/.test(trimmed)) return true;
  if (/\+/.test(trimmed) && /(WHITE|CYAN|RIGHT|SMLSIZE|MIDSIZE|DBLSIZE|GREEN|RED|YELLOW|ORANGE|MAGENTA|LIME)/.test(trimmed)) {
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
export function validateRoundedPanelArcCalls(source: string): ValidationIssue[] {
  if (!source.includes("drawFilledCircle") || !source.includes("drawArc")) {
    return [];
  }

  const issues: ValidationIssue[] = [];
  const wrongTopLeft = /drawArc\(\s*[^,]+\s*\+\s*\w*cr\w*\s*,\s*[^,]+\s*\+\s*\w*cr\w*\s*,\s*[^,]+\s*,\s*180\s*,\s*270\b/gi;

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
export function validateDrawAnnulusRadiusOrder(source: string): ValidationIssue[] {
  if (!source.includes("drawAnnulus")) return [];

  const issues: ValidationIssue[] = [];

  for (const argsSource of extractCallArgStrings(source, "lcd", "drawAnnulus")) {
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

export function validateRuntimeApiUsage(source: string): ValidationIssue[] {
  return [
    ...validateLcdDrawLineCalls(source),
    ...validateBitmapGetSizeCalls(source),
    ...validateGlobalGetSizeCalls(source),
    ...validateRoundedPanelArcCalls(source),
    ...validateDrawAnnulusRadiusOrder(source),
  ];
}

export function validateLcdApiUsage(source: string): ValidationIssue[] {
  return validateRuntimeApiUsage(source);
}
