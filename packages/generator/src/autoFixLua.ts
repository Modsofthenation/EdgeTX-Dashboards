/**
 * Deterministic repairs for common AI Lua mistakes that fail on radio/WASM.
 * Applied during workspace prepare (before validation) so agent mid-run
 * validateWidget and finalize both benefit.
 */
import { remapPreviewOnlyColorLiterals } from "@widget-gen/editor-core";
import {
  extractCallArgStrings,
  extractLcdCallArgStrings,
  splitTopLevelArgs,
} from "./lcdApiValidate.ts";

export interface AutoFixResult {
  source: string;
  applied: string[];
}

interface CallSite {
  /** Index of `namespace.method(` */
  callStart: number;
  /** Index after closing `)` */
  callEnd: number;
  args: string[];
}

const DRAW_LINE_PATTERN = /^(SOLID|DOTTED|\d+)$/;

function looksLikeColorArg(arg: string): boolean {
  const trimmed = arg.trim();
  if (!trimmed) return false;
  if (DRAW_LINE_PATTERN.test(trimmed)) return false;
  if (
    /^(WHITE|BLACK|GREY|GRAY|RED|GREEN|BLUE|YELLOW|ORANGE|LIGHTGREY|DARKGREY|BRIGHTGREEN|DARKGREEN|DARKBLUE|DARKRED|LIGHTWHITE|CYAN|MAGENTA|LIME|LIGHTRED)$/i.test(
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
  ) {
    return true;
  }
  return false;
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

function findNamespacedCalls(
  source: string,
  namespace: string,
  method: string,
): CallSite[] {
  const sites: CallSite[] = [];
  const needle = `${namespace}.${method}(`;
  let index = 0;

  while (index < source.length) {
    const start = source.indexOf(needle, index);
    if (start === -1) break;

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
      sites.push({
        callStart: start,
        callEnd: i,
        args: splitTopLevelArgs(argsSource),
      });
    }
    index = i;
  }

  return sites;
}

function rewriteNamespacedCalls(
  source: string,
  namespace: string,
  method: string,
  rewriteArgs: (args: string[]) => string[] | null,
): { source: string; count: number } {
  const sites = findNamespacedCalls(source, namespace, method);
  let out = source;
  let count = 0;

  for (const site of [...sites].reverse()) {
    const nextArgs = rewriteArgs(site.args);
    if (!nextArgs) continue;
    const replacement = `${namespace}.${method}(${nextArgs.join(", ")})`;
    out = out.slice(0, site.callStart) + replacement + out.slice(site.callEnd);
    count++;
  }

  return { source: out, count };
}

function fixColorAliases(source: string, applied: string[]): string {
  const remapped = remapPreviewOnlyColorLiterals(source);
  applied.push(...remapped.applied);
  return remapped.source;
}

function fixDrawLinePattern(source: string, applied: string[]): string {
  const { source: next, count } = rewriteNamespacedCalls(
    source,
    "lcd",
    "drawLine",
    (args) => {
      if (args.length <= 4) return null;
      const patternArg = args[4];
      if (DRAW_LINE_PATTERN.test(patternArg)) return null;
      if (!looksLikeColorArg(patternArg)) return null;
      // Insert SOLID before the color/flags arg.
      return [...args.slice(0, 4), "SOLID", ...args.slice(4)];
    },
  );
  if (count > 0) {
    applied.push(`inserted SOLID into ${count} lcd.drawLine call(s)`);
  }
  return next;
}

function fixTopLeftArcAngles(source: string, applied: string[]): string {
  if (!source.includes("drawFilledCircle") || !source.includes("drawArc")) {
    return source;
  }

  const wrongTopLeft =
    /drawArc\(\s*([^,]+)\s*\+\s*(\w*cr\w*)\s*,\s*([^,]+)\s*\+\s*(\w*cr\w*)\s*,\s*([^,]+)\s*,\s*180\s*,\s*270\b/gi;

  let count = 0;
  const next = source.replace(wrongTopLeft, (_m, x, cr1, y, cr2, r) => {
    count++;
    return `drawArc(${x} + ${cr1}, ${y} + ${cr2}, ${r}, 270, 360`;
  });

  if (count > 0) {
    applied.push(
      `corrected ${count} top-left drawArc angle(s) from 180,270 → 270,360`,
    );
  }
  return next;
}

function fixAnnulusRadii(source: string, applied: string[]): string {
  if (!source.includes("drawAnnulus")) return source;

  const { source: next, count } = rewriteNamespacedCalls(
    source,
    "lcd",
    "drawAnnulus",
    (args) => {
      if (args.length < 4) return null;
      const r1 = args[2].trim();
      const r2 = args[3].trim();

      if (/rOut|r_outer|outer/i.test(r1) && /rIn|r_inner|inner/i.test(r2)) {
        return [args[0], args[1], args[3], args[2], ...args.slice(4)];
      }

      const n1 = Number(r1);
      const n2 = Number(r2);
      if (Number.isFinite(n1) && Number.isFinite(n2) && n1 > n2) {
        return [args[0], args[1], args[3], args[2], ...args.slice(4)];
      }
      return null;
    },
  );

  if (count > 0) {
    applied.push(
      `swapped inner/outer radii on ${count} lcd.drawAnnulus call(s)`,
    );
  }
  return next;
}

function fixModelsBitmapPaths(source: string, applied: string[]): string {
  if (!/["']\/MODELS\/[^"']+\.(png|bmp)["']/i.test(source)) {
    return source;
  }
  const next = source.replace(
    /(["'])\/MODELS\/([^"']+\.(?:png|bmp))\1/gi,
    "$1/IMAGES/$2$1",
  );
  if (next !== source) {
    applied.push("rewrote /MODELS/*.png paths to /IMAGES/");
  }
  return next;
}

function fixBitmapGetSize(source: string, applied: string[]): string {
  const { source: next, count } = rewriteNamespacedCalls(
    source,
    "Bitmap",
    "getSize",
    (args) => {
      if (args.length === 0) return null;
      if (args.length === 1 && looksLikeBitmapPathArg(args[0])) {
        // Cannot invent a handle — leave for validator.
        return null;
      }
      if (args.length >= 2) {
        // Prefer the last non-path arg (usually the handle).
        const handle =
          [...args].reverse().find((a) => !looksLikeBitmapPathArg(a)) ??
          args[args.length - 1];
        if (looksLikeBitmapPathArg(handle)) return null;
        return [handle];
      }
      return null;
    },
  );
  if (count > 0) {
    applied.push(
      `normalized ${count} Bitmap.getSize call(s) to handle-only argument`,
    );
  }
  return next;
}

function fixFilledRectOpacity(source: string, applied: string[]): string {
  const { source: next, count } = rewriteNamespacedCalls(
    source,
    "lcd",
    "drawFilledRectangle",
    (args) => {
      if (args.length < 6) return null;
      const opacity = args[5].trim();
      const n = Number(opacity);
      if (!Number.isFinite(n) || n <= 15) return null;
      // Map 0–255 style to 0–15 EdgeTX blend.
      const clamped = Math.max(0, Math.min(15, Math.round((n * 15) / 255)));
      return [...args.slice(0, 5), String(clamped)];
    },
  );
  if (count > 0) {
    applied.push(
      `clamped ${count} drawFilledRectangle opacity value(s) to 0–15`,
    );
  }
  return next;
}

function fixMathDeg(source: string, applied: string[]): string {
  if (!source.includes("math.deg")) return source;
  let count = 0;
  const next = source.replace(/math\.deg\s*\(([^)]+)\)/g, (_m, expr) => {
    count++;
    return `math.floor((${expr}) + 0.5)`;
  });
  if (count > 0) {
    applied.push(
      `replaced ${count} math.deg() call(s) with math.floor(x + 0.5)`,
    );
  }
  return next;
}

/** Apply safe, deterministic Lua repairs. Idempotent for already-correct source. */
export function autoFixLua(source: string): AutoFixResult {
  const applied: string[] = [];
  let out = source;

  out = fixColorAliases(out, applied);
  out = fixDrawLinePattern(out, applied);
  out = fixTopLeftArcAngles(out, applied);
  out = fixAnnulusRadii(out, applied);
  out = fixModelsBitmapPaths(out, applied);
  out = fixBitmapGetSize(out, applied);
  out = fixFilledRectOpacity(out, applied);
  out = fixMathDeg(out, applied);

  return { source: out, applied };
}

/** True when auto-fix would change the source (for tests / dry-run). */
export function wouldAutoFixLua(source: string): boolean {
  return autoFixLua(source).applied.length > 0;
}

/** Re-export helpers used by tests for call-shape fixtures. */
export const _test = {
  extractLcdCallArgStrings,
  extractCallArgStrings,
  splitTopLevelArgs,
};
