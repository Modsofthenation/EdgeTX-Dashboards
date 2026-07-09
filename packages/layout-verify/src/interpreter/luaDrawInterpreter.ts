import { resolvePreviewDimensions, extractRefreshBody, findRefreshBodyStartLine } from "@widget-gen/shared";
import { BASE_MOCK, getMockForSensor, type MockTelemetry } from "../mockTelemetry.js";
import type { ArgSpan, DrawRecord, DrawSourceRef, InterpretResult, LayoutScenario } from "../types.js";

export type EdgeColor =
  | "WHITE"
  | "BLACK"
  | "GREY"
  | "LIGHTGREY"
  | "RED"
  | "LIGHTRED"
  | "DARKRED"
  | "GREEN"
  | "BRIGHTGREEN"
  | "DARKGREEN"
  | "BLUE"
  | "DARKBLUE"
  | "YELLOW"
  | "ORANGE"
  | "LIME"
  | "CYAN"
  | "MAGENTA"
  | "DARKGREY";

export const COLOR_MAP: Record<EdgeColor, string> = {
  WHITE: "#ffffff",
  BLACK: "#000000",
  GREY: "#808080",
  LIGHTGREY: "#d3d3d3",
  RED: "#ff0000",
  LIGHTRED: "#ff6666",
  DARKRED: "#8b0000",
  GREEN: "#008000",
  BRIGHTGREEN: "#00ff00",
  DARKGREEN: "#006400",
  BLUE: "#0000ff",
  DARKBLUE: "#00008b",
  YELLOW: "#ffff00",
  ORANGE: "#ffa500",
  LIME: "#88ff00",
  CYAN: "#00ffff",
  MAGENTA: "#ff00ff",
  DARKGREY: "#404040",
};

/** EdgeTX theme constants — preview approximations of default dark theme. */
export const THEME_COLOR_MAP: Record<string, string> = {
  COLOR_THEME_PRIMARY1: "#2a3a5c",
  COLOR_THEME_PRIMARY2: "#1a1a24",
  COLOR_THEME_PRIMARY3: "#3a3a48",
  COLOR_THEME_SECONDARY1: "#e0e0e8",
  COLOR_THEME_SECONDARY2: "#a0a0b0",
  COLOR_THEME_SECONDARY3: "#484858",
  COLOR_THEME_FOCUS: "#4a90d9",
  COLOR_THEME_ACTIVE: "#5ab0ff",
  COLOR_THEME_WARNING: "#e8a020",
  COLOR_THEME_DISABLED: "#606068",
  CUSTOM_COLOR: "#ff8800",
};

export type PreviewDrawCommand = DrawRecord;

const FONT_SIZES: Record<string, number> = {
  SMLSIZE: 12,
  MIDSIZE: 18,
  DBLSIZE: 26,
};

export interface RectValue {
  x: number;
  y: number;
  w: number;
  h: number;
}

type EvalCtxValue = number | string | RectValue;
type EvalCtx = Record<string, EvalCtxValue>;

function isRectValue(value: unknown): value is RectValue {
  return (
    typeof value === "object" &&
    value !== null &&
    "x" in value &&
    "y" in value &&
    "w" in value &&
    "h" in value
  );
}
type EvalDims = { zoneW: number; zoneH: number; lcdW: number; lcdH: number; optionIndex?: Map<number, string> };

export interface PreviewParseMeta {
  warnings: string[];
  skippedTextCount: number;
  zeroCoordCount: number;
}

let lastPreviewParseMeta: PreviewParseMeta = {
  warnings: [],
  skippedTextCount: 0,
  zeroCoordCount: 0,
};

export function getLastPreviewParseMeta(): PreviewParseMeta {
  return lastPreviewParseMeta;
}

const EDGE_COLOR_NAMES = Object.keys(COLOR_MAP).sort((a, b) => b.length - a.length) as EdgeColor[];

function substituteCtxNumbers(expr: string, ctx: EvalCtx): string {
  let e = expr;
  const keys = Object.keys(ctx)
    .filter((k) => typeof ctx[k] === "number")
    .sort((a, b) => b.length - a.length);
  for (const k of keys) {
    e = e.replace(new RegExp(`\\b${k.replace(/\./g, "\\.")}\\b(?!\\.)`, "g"), String(ctx[k]));
  }
  return e;
}

function evalRectFromCall(expr: string, ctx: EvalCtx, dims: EvalDims): RectValue | null {
  const trimmed = expr.trim();
  const m = trimmed.match(/^(?:textRowRect|rect)\s*\(\s*(.+)\s*\)$/);
  if (!m) return null;
  const args = splitCallArgs(m[1]!);
  if (args.length < 4) return null;
  return {
    x: evalNumberExpr(args[0]!, ctx, dims),
    y: evalNumberExpr(args[1]!, ctx, dims),
    w: evalNumberExpr(args[2]!, ctx, dims),
    h: evalNumberExpr(args[3]!, ctx, dims),
  };
}

function evalRectMemberNumber(expr: string, ctx: EvalCtx): number | null {
  const member = expr.match(/^(\w+)\.(x|y|w|h)$/);
  if (!member) return null;
  const rect = ctx[member[1]!];
  if (!isRectValue(rect)) return null;
  return rect[member[2] as keyof RectValue];
}

function evalRectHelperNumber(expr: string, ctx: EvalCtx): number | null {
  const bottom = expr.match(/^rectBottom\s*\(\s*(\w+)\s*\)$/);
  if (bottom) {
    const rect = ctx[bottom[1]!];
    if (isRectValue(rect)) return rect.y + rect.h;
  }
  const right = expr.match(/^rectRight\s*\(\s*(\w+)\s*\)$/);
  if (right) {
    const rect = ctx[right[1]!];
    if (isRectValue(rect)) return rect.x + rect.w;
  }
  return null;
}

function evalTableMemberNumber(expr: string, ctx: EvalCtx): number | null {
  const member = expr.match(/^(\w+)\.(\w+)$/);
  if (!member) return null;
  const compound = `${member[1]}.${member[2]}`;
  const value = ctx[compound];
  return typeof value === "number" ? value : null;
}

function substituteDimensionAliases(expr: string, dims: EvalDims): string {
  return expr
    .replace(/\bLCD_W\b/g, String(dims.lcdW))
    .replace(/\bLCD_H\b/g, String(dims.lcdH))
    .replace(/\bzone\.w\b/g, String(dims.zoneW))
    .replace(/\bzone\.h\b/g, String(dims.zoneH))
    .replace(/(?<![a-zA-Z0-9_])w(?![a-zA-Z0-9_])/g, String(dims.zoneW))
    .replace(/(?<![a-zA-Z0-9_])h(?![a-zA-Z0-9_])/g, String(dims.zoneH));
}

function evalAdditiveTerms(expr: string, ctx: EvalCtx, dims: EvalDims): number | null {
  let depth = 0;
  for (let i = expr.length - 1; i >= 0; i--) {
    const ch = expr[i];
    if (ch === ")") depth++;
    else if (ch === "(") depth--;
    else if (depth === 0 && (ch === "+" || ch === "-") && i > 0) {
      const left = expr.slice(0, i).trim();
      const right = expr.slice(i + 1).trim();
      if (!left || !right) continue;
      const l = evalNumberExpr(left, ctx, dims);
      const r = evalNumberExpr(right, ctx, dims);
      return ch === "+" ? l + r : l - r;
    }
  }
  return null;
}

function buildSrcSensorMap(source: string): Map<string, string> {
  const map = new Map<string, string>();
  const createBlock = source.match(/src\s*=\s*\{([\s\S]*?)\}/);
  if (!createBlock) return map;

  for (const m of createBlock[1].matchAll(/(\w+)\s*=\s*cacheSource\s*\(\s*"([^"]+)"\s*\)/g)) {
    map.set(m[1], m[2]);
  }
  return map;
}

function resolveColorToken(
  token: string,
  rgbMap: Record<string, string>,
  ctx: EvalCtx,
  fallback: string
): string | null {
  if (/^#[0-9a-fA-F]{6}$/.test(token)) return token;
  if (token in COLOR_MAP) return COLOR_MAP[token as EdgeColor];
  if (token in THEME_COLOR_MAP) return THEME_COLOR_MAP[token];
  if (rgbMap[token]) return rgbMap[token];
  if (token in ctx) {
    const resolved = String(ctx[token]);
    if (/^#[0-9a-fA-F]{6}$/.test(resolved)) return resolved;
    if (resolved in COLOR_MAP) return COLOR_MAP[resolved as EdgeColor];
    if (resolved in THEME_COLOR_MAP) return THEME_COLOR_MAP[resolved];
    if (rgbMap[resolved]) return rgbMap[resolved];
  }
  return null;
}

function resolveColor(
  flags: string,
  rgbMap: Record<string, string>,
  ctx: EvalCtx = {},
  fallback = "#ffffff"
): string {
  const tokens = flags
    .split("+")
    .map((t) => t.trim())
    .filter(Boolean);

  for (const token of tokens) {
    const color = resolveColorToken(token, rgbMap, ctx, fallback);
    if (color) return color;
  }

  for (const name of EDGE_COLOR_NAMES) {
    if (flags.includes(name)) return COLOR_MAP[name];
  }
  for (const [name, hex] of Object.entries(THEME_COLOR_MAP)) {
    if (flags.includes(name)) return hex;
  }
  for (const [name, hex] of Object.entries(rgbMap)) {
    if (flags.includes(name)) return hex;
  }
  return fallback;
}

function resolveDrawColor(colorExpr: string, rgbMap: Record<string, string>, ctx: EvalCtx = {}): string {
  const trimmed = colorExpr.trim();
  const direct = resolveColorToken(trimmed, rgbMap, ctx, "");
  if (direct) return direct;
  if (trimmed in ctx) {
    const resolved = String(ctx[trimmed]);
    const nested = resolveColorToken(resolved, rgbMap, ctx, "");
    if (nested) return nested;
  }
  return "#808080";
}

function resolveTextAlign(flags: string): "left" | "center" | "right" {
  if (flags.includes("CENTER")) return "center";
  if (flags.includes("RIGHT")) return "right";
  return "left";
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function buildRgbColorMap(source: string): Record<string, string> {
  const map: Record<string, string> = {};
  const rgbPattern = /(\w+)\s*=\s*lcd\.RGB\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g;
  for (const m of source.matchAll(rgbPattern)) {
    map[m[1]] = rgbToHex(Number(m[2]), Number(m[3]), Number(m[4]));
  }
  return map;
}

function buildOptionIndexMap(source: string): Map<number, string> {
  const map = new Map<number, string>();
  let index = 1;
  for (const m of source.matchAll(/\{\s*"([^"]+)"\s*,\s*(?:BOOL|SOURCE|VALUE|COLOR|STRING)/g)) {
    map.set(index++, m[1]);
  }
  return map;
}

function seedWidgetContext(source: string, ctx: EvalCtx, scenario?: LayoutScenario): void {
  for (const m of source.matchAll(/\{\s*"([^"]+)"\s*,\s*BOOL\s*,\s*(\d+)\s*\}/g)) {
    const name = m[1]!;
    const defaultVal = Number(m[2]);
    if (scenario?.options && name in scenario.options) {
      ctx[name] = scenario.options[name]!;
    } else {
      ctx[name] = defaultVal;
    }
    if (name.startsWith("Show")) {
      const localName = `show${name.slice(4)}`;
      ctx[localName] = ctx[name]!;
    }
  }
  const lhBlock = source.match(/local\s+LH\s*=\s*\{([^}]+)\}/);
  if (lhBlock) {
    for (const kv of lhBlock[1]!.matchAll(/(\w+)\s*=\s*([\d.]+)/g)) {
      ctx[`LH.${kv[1]}`] = Number(kv[2]);
    }
  }
  if (scenario?.armed !== undefined) {
    ctx.armed = scenario.armed ? 1 : 0;
    ctx.FM = scenario.armed ? "Arm" : "DISARM";
    ctx.fm = ctx.FM;
  }
  ctx.flightSecs = scenario?.flightSecs ?? 3;
  ctx.displaySecs = ctx.flightSecs;
  ctx.timerSec = 154;
  if (/model\.getTimer\s*\(\s*0\s*\)/.test(source)) {
    ctx.tInfo = 1;
  }
}

function resolveFontSize(flags: string): number {
  if (flags.includes("DBLSIZE")) return FONT_SIZES.DBLSIZE;
  if (flags.includes("MIDSIZE")) return FONT_SIZES.MIDSIZE;
  if (flags.includes("SMLSIZE")) return FONT_SIZES.SMLSIZE;
  return 12;
}

function hasTopLevelConcat(expr: string): boolean {
  let depth = 0;
  for (let i = 0; i < expr.length - 1; i++) {
    const ch = expr[i];
    if (ch === '"' || ch === "'") {
      i = skipQuotedString(expr, i) - 1;
      continue;
    }
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (depth === 0 && expr[i] === "." && expr[i + 1] === ".") return true;
  }
  return false;
}

function splitConcatParts(expr: string): string[] {
  const parts: string[] = [];
  let current = "";
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];
    if (ch === '"' || ch === "'") {
      const end = skipQuotedString(expr, i);
      current += expr.slice(i, end);
      i = end;
      continue;
    }
    if (expr[i] === "." && expr[i + 1] === ".") {
      parts.push(current.trim());
      current = "";
      i += 2;
      continue;
    }
    current += ch;
    i++;
  }

  parts.push(current.trim());
  return parts.filter(Boolean);
}

function skipQuotedString(source: string, start: number): number {
  const quote = source[start];
  let i = start + 1;
  while (i < source.length) {
    if (source[i] === "\\") {
      i += 2;
      continue;
    }
    if (source[i] === quote) return i + 1;
    i++;
  }
  return source.length;
}

function evalBoolExpr(expr: string, ctx: EvalCtx, dims: EvalDims): boolean {
  let e = expr.trim();
  if (dims.optionIndex) {
    e = substituteWidgetOptions(e, ctx, dims.optionIndex);
  }
  e = e.replace(/\btInfo\.value\b/g, String(ctx.timerSec ?? 154));
  e = substituteCtxNumbers(e, ctx);
  e = substituteDimensionAliases(e, dims);
  e = e.replace(/~=/g, "!=");
  e = e.replace(/type\s*\(\s*(\w+)\s*\)\s*==\s*"string"/g, (_, name) =>
    typeof ctx[name] === "string" ? "true" : "false"
  );
  e = e.replace(/type\s*\(\s*(\w+)\s*\)\s*==\s*"number"/g, (_, name) =>
    typeof ctx[name] === "number" ? "true" : "false"
  );
  for (const [k, v] of Object.entries(ctx)) {
    if (typeof v === "number") {
      e = e.replace(new RegExp(`\\b${k}\\b(?!\\.)`, "g"), String(v));
    } else if (typeof v === "string") {
      e = e.replace(new RegExp(`\\b${k}\\b(?!\\.)`, "g"), JSON.stringify(v));
    }
  }
  e = e.replace(/\band\b/g, "&&");
  e = e.replace(/\bor\b/g, "||");
  if (!/^[\w\s\d.+\-*/%<>=!&|()"']+$/.test(e)) return false;
  try {
    return Boolean(Function(`"use strict"; return (${e})`)());
  } catch {
    return false;
  }
}

function findLastTopLevel(expr: string, token: string): number {
  let depth = 0;
  for (let i = expr.length - token.length; i >= 0; i--) {
    const ch = expr[i];
    if (ch === ")") depth++;
    else if (ch === "(") depth--;
    if (depth === 0 && expr.slice(i, i + token.length) === token) return i;
  }
  return -1;
}

function evalConcat(
  expr: string,
  ctx: EvalCtx,
  dims: EvalDims,
  srcMap: Map<string, string>,
  mock: MockTelemetry
): string {
  return splitConcatParts(stripOuterParens(expr))
    .map((part) => String(evalValue(stripOuterParens(part), ctx, dims, srcMap, mock)))
    .join("");
}

function extractParenContent(expr: string, openIndex: number): string | null {
  if (expr[openIndex] !== "(") return null;
  let depth = 0;
  for (let i = openIndex; i < expr.length; i++) {
    if (expr[i] === "(") depth++;
    else if (expr[i] === ")") {
      depth--;
      if (depth === 0) return expr.slice(openIndex + 1, i);
    }
  }
  return null;
}

function replaceMathCalls(expr: string, ctx: EvalCtx, dims: EvalDims): string {
  let e = expr;
  for (let pass = 0; pass < 12; pass++) {
    let changed = false;

    for (const fn of ["math.floor", "math.max", "math.min"] as const) {
      const idx = e.indexOf(fn);
      if (idx < 0) continue;
      const open = e.indexOf("(", idx);
      const inner = open >= 0 ? extractParenContent(e, open) : null;
      if (!inner) continue;

      let value = 0;
      if (fn === "math.floor") {
        value = Math.floor(evalNumberExpr(inner, ctx, dims));
      } else if (fn === "math.max") {
        const [a, b] = splitTopLevelArg(inner);
        value = Math.max(evalNumberExpr(a, ctx, dims), evalNumberExpr(b, ctx, dims));
      } else {
        const [a, b] = splitTopLevelArg(inner);
        value = Math.min(evalNumberExpr(a, ctx, dims), evalNumberExpr(b, ctx, dims));
      }

      e = e.slice(0, idx) + String(value) + e.slice(open + inner.length + 2);
      changed = true;
      break;
    }

    if (!changed) break;
  }
  return e;
}

function splitTopLevelArg(inner: string): [string, string] {
  let depth = 0;
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === "(") depth++;
    else if (inner[i] === ")") depth--;
    else if (inner[i] === "," && depth === 0) {
      return [inner.slice(0, i).trim(), inner.slice(i + 1).trim()];
    }
  }
  return [inner.trim(), "0"];
}

function evalNumberExpr(expr: string, ctx: EvalCtx, dims: EvalDims): number {
  let e = expr.trim();
  const rectMember = evalRectMemberNumber(e, ctx);
  if (rectMember !== null) return rectMember;
  const rectHelper = evalRectHelperNumber(e, ctx);
  if (rectHelper !== null) return rectHelper;
  const tableMember = evalTableMemberNumber(e, ctx);
  if (tableMember !== null) return tableMember;
  const layoutHelper = evalLayoutHelper(e, ctx, dims);
  if (layoutHelper !== null) return layoutHelper;

  if (dims.optionIndex) {
    e = substituteWidgetOptions(e, ctx, dims.optionIndex);
  }
  e = substituteCtxNumbers(e, ctx);
  e = substituteDimensionAliases(e, dims);
  e = replaceMathCalls(e, ctx, dims);
  e = e.replace(/~=/g, "!=");
  if (/[<>=!]/.test(e) || /\band\b|\bor\b/.test(e)) {
    try {
      return evalBoolExpr(expr, ctx, dims) ? 1 : 0;
    } catch {
      return 0;
    }
  }
  if (/^[\d\s+\-*/%.()]+$/.test(e)) {
    try {
      return Function(`"use strict"; return (${e})`)() as number;
    } catch {
      return 0;
    }
  }
  if (/[a-zA-Z_]/.test(e)) {
    const additive = evalAdditiveTerms(e, ctx, dims);
    if (additive !== null && Number.isFinite(additive)) return additive;
  }
  const n = Number(e);
  return Number.isFinite(n) ? n : 0;
}

function evalLayoutHelper(expr: string, ctx: EvalCtx, dims: EvalDims): number | null {
  const sml = (ctx["LH.SML"] as number) ?? 12;
  const gap = (ctx["LH.GAP"] as number) ?? 4;
  const mid = (ctx["LH.MID"] as number) ?? 18;

  const stripM = expr.match(/^stripBlockH\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)$/);
  if (stripM) {
    const showAtt = evalNumberExpr(stripM[1]!, ctx, dims);
    const showCapa = evalNumberExpr(stripM[2]!, ctx, dims);
    const inner = sml + gap + mid;
    if (!showAtt && !showCapa) return 0;
    const pad = 8;
    if (showAtt && showCapa) return pad + inner * 2 + gap + pad;
    return pad + inner + pad;
  }
  if (/^barsPctRowH\s*\(\s*\)$/.test(expr.trim())) return sml;
  if (/^satelliteBelowH\s*\(\s*\)$/.test(expr.trim())) return 6 + sml + gap + mid + gap + sml;
  const gaugeM = expr.match(/^gaugeZoneH\s*\(\s*(.+)\s*\)$/);
  if (gaugeM) {
    const rOut = evalNumberExpr(gaugeM[1]!, ctx, dims);
    return rOut * 2 + (6 + sml + gap + mid + gap + sml);
  }
  const stripInnerM = expr.match(/^stripInnerRowH\s*\(\s*\)$/);
  if (stripInnerM) return sml + gap + mid;
  return null;
}

function evalTruncStr(expr: string, ctx: EvalCtx, dims: EvalDims, srcMap: Map<string, string>, mock: MockTelemetry): string | null {
  const m = expr.match(/^truncStr\s*\(\s*(.+)\s*,\s*(\d+)\s*\)$/);
  if (!m) return null;
  const inner = evalValue(m[1]!, ctx, dims, srcMap, mock);
  const maxChars = Number(m[2]);
  const str = String(inner);
  if (str.length <= maxChars) return str;
  if (maxChars < 2) return str.slice(0, maxChars);
  return `${str.slice(0, maxChars - 1)}.`;
}

function evalFmtDuration(expr: string, ctx: EvalCtx, dims: EvalDims): string | null {
  const m = expr.match(/^fmtDuration\s*\(\s*(.+)\s*\)$/);
  if (!m) return null;
  const sec = Math.floor(evalNumberExpr(m[1]!, ctx, dims) + 0.5);
  if (sec <= 0) return "--:--";
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function evalFmtTimer(expr: string, ctx: EvalCtx, dims: EvalDims): string | null {
  const m = expr.match(/^fmtTimer\s*\(\s*(.+)\s*\)$/);
  if (!m) return null;
  const raw = evalNumberExpr(m[1], ctx, dims);
  if (raw < 0) return "00:00";
  const sec = Math.floor(raw + 0.5);
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function substituteWidgetOptions(expr: string, ctx: EvalCtx, optionIndex: Map<number, string>): string {
  let e = expr;
  e = e.replace(/widget\.options\.(\w+)/g, (_, name: string) => {
    const value = ctx[name];
    return typeof value === "number" ? String(value) : "0";
  });
  e = e.replace(/widget\.options\[(\d+)\]/g, (_, index: string) => {
    const name = optionIndex.get(Number(index));
    if (!name) return "0";
    const value = ctx[name];
    return typeof value === "number" ? String(value) : "0";
  });
  return e;
}

function evalFmtNum(expr: string, ctx: EvalCtx, dims: EvalDims): string | null {
  const m = expr.match(/fmtNum\s*\(\s*([^,]+)\s*,\s*(\d+)\s*\)/);
  if (!m) return null;
  const value = evalNumberExpr(m[1], ctx, dims);
  const decimals = Number(m[2]);
  if (value === 0) return "--";
  return value.toFixed(decimals);
}

function stripOuterParens(expr: string): string {
  let e = expr.trim();
  while (e.startsWith("(")) {
    const inner = extractParenContent(e, 0);
    if (inner === null) break;
    if (inner.length + 2 !== e.length) break;
    e = inner.trim();
  }
  return e;
}

function looksLikeUnevaluated(value: string): boolean {
  return (
    /\band\s+.+\s+or\s+/.test(value) ||
    value.includes("telem(") ||
    value.includes("widget.") ||
    /^tostring\s*\(/.test(value) ||
    /^string\.format\s*\(/.test(value) ||
    (value.includes("..") && !/^"[^"]*"$/.test(value))
  );
}

function evalStringFormat(expr: string, ctx: EvalCtx, dims: EvalDims): string | null {
  const marker = "string.format(";
  const start = expr.indexOf(marker);
  if (start < 0) return null;
  if (start > 0) return null;

  const open = start + marker.length - 1;
  const inner = extractParenContent(expr, open);
  if (inner === null) return null;

  const quoteEnd = inner.indexOf('"', 1);
  if (quoteEnd < 0) return null;
  const fmt = inner.slice(1, quoteEnd);
  const argsSource = inner.slice(quoteEnd + 1).replace(/^,\s*/, "").trim();
  if (!argsSource) return null;

  const args = splitTopLevelArgs(argsSource).map((arg) => evalNumberExpr(arg, ctx, dims));
  let out = fmt;
  let argIndex = 0;
  out = out.replace(/%0(\d+)d/g, (_, width) => {
    const value = args[argIndex++] ?? 0;
    return String(Math.round(value)).padStart(Number(width), "0");
  });
  out = out.replace(/%\.(\d+)f/g, (_, digits) => {
    const value = args[argIndex++] ?? 0;
    return value.toFixed(Number(digits));
  });
  out = out.replace(/%d/g, () => String(Math.round(args[argIndex++] ?? 0)));
  return out;
}

function splitTopLevelArgs(source: string): string[] {
  const args: string[] = [];
  let current = "";
  let depth = 0;
  let i = 0;

  while (i < source.length) {
    const ch = source[i];
    if (ch === "(") {
      depth++;
      current += ch;
      i++;
      continue;
    }
    if (ch === ")") {
      depth--;
      current += ch;
      i++;
      continue;
    }
    if (ch === "," && depth === 0) {
      args.push(current.trim());
      current = "";
      i++;
      continue;
    }
    current += ch;
    i++;
  }

  if (current.trim()) args.push(current.trim());
  return args;
}

function evalTelem(
  expr: string,
  srcMap: Map<string, string>,
  mock: MockTelemetry
): number | string | null {
  const m = expr.match(/telem\s*\(\s*widget\.src\.(\w+)\s*\)/);
  if (!m) return null;
  const sensor = srcMap.get(m[1]);
  return sensor ? getMockForSensor(sensor, mock) : 0;
}

function evalLuaAndOr(
  expr: string,
  ctx: EvalCtx,
  dims: EvalDims,
  srcMap: Map<string, string>,
  mock: MockTelemetry
): EvalCtxValue | null {
  const orIdx = findLastTopLevel(expr, " or ");
  if (orIdx < 0) return null;

  const left = expr.slice(0, orIdx).trim();
  const falseBranch = expr.slice(orIdx + 4).trim();
  const andIdx = findLastTopLevel(left, " and ");
  if (andIdx < 0) return null;

  const cond = left.slice(0, andIdx).trim();
  const trueBranch = left.slice(andIdx + 5).trim();
  if (evalBoolExpr(cond, ctx, dims)) {
    return evalValue(trueBranch, ctx, dims, srcMap, mock);
  }
  return evalValue(falseBranch, ctx, dims, srcMap, mock);
}

function evalTernary(
  expr: string,
  ctx: EvalCtx,
  dims: EvalDims,
  srcMap: Map<string, string>,
  mock: MockTelemetry
): EvalCtxValue | null {
  const andOr = evalLuaAndOr(expr, ctx, dims, srcMap, mock);
  if (andOr !== null) return andOr;

  const m = expr.match(/^(.+?)\s+and\s+(.+?)\s+or\s+(.+)$/);
  if (!m) return null;
  if (evalBoolExpr(m[1], ctx, dims)) {
    return evalValue(m[2], ctx, dims, srcMap, mock);
  }
  return evalValue(m[3], ctx, dims, srcMap, mock);
}

function evalValue(
  raw: string,
  ctx: EvalCtx,
  dims: EvalDims,
  srcMap: Map<string, string>,
  mock: MockTelemetry
): EvalCtxValue {
  const expr = stripOuterParens(raw.trim().replace(/,\s*$/, ""));

  const rectVal = evalRectFromCall(expr, ctx, dims);
  if (rectVal) return rectVal;

  const layoutNum = evalLayoutHelper(expr, ctx, dims);
  if (layoutNum !== null) return layoutNum;

  if (hasTopLevelConcat(expr)) {
    return evalConcat(expr, ctx, dims, srcMap, mock);
  }

  const telemVal = evalTelem(expr, srcMap, mock);
  if (telemVal !== null) return telemVal;

  const fmtNumVal = evalFmtNum(expr, ctx, dims);
  if (fmtNumVal !== null) return fmtNumVal;

  const fmtTimerVal = evalFmtTimer(expr, ctx, dims);
  if (fmtTimerVal !== null) return fmtTimerVal;

  const fmtDurationVal = evalFmtDuration(expr, ctx, dims);
  if (fmtDurationVal !== null) return fmtDurationVal;

  const formatVal = evalStringFormat(expr, ctx, dims);
  if (formatVal !== null) return formatVal;

  const truncVal = evalTruncStr(expr, ctx, dims, srcMap, mock);
  if (truncVal !== null) return truncVal;

  const ternaryVal = evalTernary(expr, ctx, dims, srcMap, mock);
  if (ternaryVal !== null) return ternaryVal;

  const orIdx = findLastTopLevel(expr, " or ");
  if (orIdx >= 0) {
    const left = evalValue(expr.slice(0, orIdx).trim(), ctx, dims, srcMap, mock);
    if (typeof left === "string" && left === "") {
      return evalValue(expr.slice(orIdx + 4).trim(), ctx, dims, srcMap, mock);
    }
    return left;
  }

  const tostringM = expr.match(/^tostring\s*\(\s*(.+)\s*\)$/);
  if (tostringM) {
    const inner = evalValue(tostringM[1]!, ctx, dims, srcMap, mock);
    return String(inner);
  }

  const widgetMember = expr.match(/^widget\.(\w+)$/);
  if (widgetMember) {
    const prop = widgetMember[1]!;
    if (prop === "armed") return ctx.armed ? 1 : 0;
    if (prop === "flightSecs") return (ctx.flightSecs as number) ?? 3;
    if (prop === "lastFlightSecs") return 0;
    if (prop in ctx) return ctx[prop]!;
  }

  if (expr in ctx) {
    return ctx[expr]!;
  }

  const timerMember = expr.match(/^tInfo\.value$/);
  if (timerMember) {
    return ctx.timerSec ?? 154;
  }

  if (expr === "LCD_W") return dims.lcdW;
  if (expr === "LCD_H") return dims.lcdH;

  if (/^"[^"]*"$/.test(expr) || /^'[^']*'$/.test(expr)) {
    return expr.slice(1, -1);
  }

  if (/^[\d.]+$/.test(expr)) {
    return Number(expr);
  }

  if (/^[\w\s\d.+\-*/()%]+$/.test(expr)) {
    const numeric = evalNumberExpr(expr, ctx, dims);
    if (Number.isFinite(numeric)) return numeric;
  }

  return expr;
}

function resolveTextTemplate(
  template: string,
  ctx: EvalCtx,
  dims: EvalDims,
  srcMap: Map<string, string>,
  mock: MockTelemetry
): string {
  const t = template.trim();

  if (/^[\w]+$/.test(t) && t in ctx) {
    return String(ctx[t]);
  }

  if (
    hasTopLevelConcat(t) ||
    /^tostring\s*\(/.test(t) ||
    /^string\.format\s*\(/.test(t) ||
    /^truncStr\s*\(/.test(t) ||
    /\band\s+.+\s+or\s+/.test(t)
  ) {
    const value = evalValue(t, ctx, dims, srcMap, mock);
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
  }

  if (/^"[^"]*"$/.test(t) || /^'[^']*'$/.test(t)) {
    return t.slice(1, -1);
  }

  return t.replace(/\\n/g, "\n");
}

function isRenderableText(text: string): boolean {
  if (!text) return false;
  if (text.includes("widget.") || text.includes("telem(")) return false;
  if (/\bfmtNum\s*\(/.test(text)) return false;
  if (/string\.format\s*\(/.test(text)) return false;
  if (/\.\./.test(text)) return false;
  if (/^tostring\s*\(/.test(text)) return false;
  if (looksLikeUnevaluated(text)) return false;
  return true;
}

function collectTelemAssignments(
  body: string,
  ctx: EvalCtx,
  dims: EvalDims,
  srcMap: Map<string, string>,
  mock: MockTelemetry
): void {
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    const localMatch = trimmed.match(/^(?:local\s+)?(\w+)\s*=\s*(.+)$/);
    if (!localMatch) continue;
    const [, name, expr] = localMatch;
    if (!expr.includes("telem(") && !expr.includes("model.getTimer")) continue;
    if (expr.includes("model.getTimer")) {
      ctx.timerSec = ctx.timerSec ?? 154;
      continue;
    }
    const value = evalValue(expr, ctx, dims, srcMap, mock);
    if (typeof value === "string" && (value.includes("widget.") || value.includes("telem("))) continue;
    ctx[name] = value;
  }
}

function collectAssignments(
  body: string,
  ctx: EvalCtx,
  dims: EvalDims,
  srcMap: Map<string, string>,
  mock: MockTelemetry
): void {
  const applyLine = (trimmed: string): boolean => {
    const localMatch = trimmed.match(/^(?:local\s+)?(\w+)\s*=\s*(.+)$/);
    if (!localMatch) return false;

    const [, name, expr] = localMatch;
    if (name === "armed" && expr.trim() === "false") return false;
    if (expr.includes("model.getTimer")) {
      ctx.timerSec = ctx.timerSec ?? 154;
      return false;
    }
    if (
      name === "timerVal" &&
      expr.trim() === "0" &&
      typeof ctx.timerVal === "number" &&
      ctx.timerVal > 0
    ) {
      return false;
    }
    if (
      name === "modelBandH" &&
      expr.trim() === "0" &&
      typeof ctx.modelBandH === "number" &&
      ctx.modelBandH > 0
    ) {
      return false;
    }
    const trimmedExpr = expr.trim();
    if (
      (trimmedExpr === '"--"' || trimmedExpr === "'--'" || trimmedExpr === '"---"' || trimmedExpr === "'---'") &&
      typeof ctx[name] === "string" &&
      ctx[name] !== "--" &&
      ctx[name] !== "---"
    ) {
      return false;
    }
    if (expr.startsWith("function")) return false;
    const tableLit = trimmedExpr.match(/^\{\s*([^}]+)\s*\}$/);
    if (tableLit) {
      for (const kv of tableLit[1]!.matchAll(/(\w+)\s*=\s*([\d.]+)/g)) {
        ctx[`${name}.${kv[1]}`] = Number(kv[2]);
      }
      return true;
    }
    if (trimmedExpr.startsWith("{")) return false;
    if (/^widget\.\w+$/.test(trimmedExpr)) {
      const value = evalValue(expr, ctx, dims, srcMap, mock);
      if (value !== expr) {
        ctx[name] = value;
        return true;
      }
      return false;
    }

    const value = evalValue(expr, ctx, dims, srcMap, mock);
    if (isRectValue(value)) {
      ctx[name] = value;
      return true;
    }
    if (typeof value === "string" && looksLikeUnevaluated(value)) return false;
    if (typeof value === "string" && (value.includes("widget.") || value.includes("telem("))) {
      return false;
    }
    if (typeof value === "string" && value.includes("..")) return false;
    if (ctx[name] === value) return false;
    ctx[name] = value;
    return true;
  };

  for (let pass = 0; pass < 20; pass++) {
    let changed = false;
    let ifDepth = 0;
    for (const line of body.split("\n")) {
      const trimmed = line.trim();
      if (/^if\s+.+\sthen\s*$/.test(trimmed)) {
        ifDepth++;
        continue;
      }
      if (trimmed === "else" || trimmed.startsWith("elseif ")) {
        continue;
      }
      if (trimmed === "end") {
        ifDepth = Math.max(0, ifDepth - 1);
        continue;
      }
      if (ifDepth > 0) continue;
      if (applyLine(trimmed)) changed = true;
    }
    if (!changed) break;
  }
}

function buildContext(source: string, mock: MockTelemetry): EvalCtx {
  const ctx: EvalCtx = { ...mock };
  const srcMap = buildSrcSensorMap(source);

  for (const [srcKey, sensor] of srcMap) {
    ctx[srcKey] = getMockForSensor(sensor, mock);
  }

  ctx.rqly = ctx.RQLY ?? mock.RQLY;
  ctx.rssi = ctx["1RSS"] ?? mock["1RSS"];
  ctx.v = ctx.RxBt ?? mock.RxBt;
  ctx.a = ctx.Curr ?? mock.Curr;
  ctx.fm = ctx.FM ?? mock.FM;

  for (const [name, hex] of Object.entries(buildRgbColorMap(source))) {
    ctx[name] = hex;
  }

  return ctx;
}

function splitCallArgs(argsSource: string): string[] {
  const args: string[] = [];
  let current = "";
  let depth = 0;
  let i = 0;

  while (i < argsSource.length) {
    const ch = argsSource[i];
    if (ch === '"' || ch === "'") {
      const end = skipQuotedString(argsSource, i);
      current += argsSource.slice(i, end);
      i = end;
      continue;
    }
    if (ch === "(") {
      depth++;
      current += ch;
      i++;
      continue;
    }
    if (ch === ")") {
      depth--;
      current += ch;
      i++;
      continue;
    }
    if (ch === "," && depth === 0) {
      args.push(current.trim());
      current = "";
      i++;
      continue;
    }
    current += ch;
    i++;
  }

  if (current.trim()) args.push(current.trim());
  return args;
}

function splitCallArgsWithSpans(argsSource: string, baseOffset: number): { args: string[]; spans: ArgSpan[] } {
  const args: string[] = [];
  const spans: ArgSpan[] = [];
  let depth = 0;
  let argStart = 0;
  let i = 0;

  const pushArg = (start: number, end: number) => {
    const slice = argsSource.slice(start, end);
    const trimmed = slice.trim();
    if (!trimmed) return;
    const leading = slice.length - slice.trimStart().length;
    const spanStart = baseOffset + start + leading;
    args.push(trimmed);
    spans.push({ start: spanStart, end: spanStart + trimmed.length });
  };

  while (i <= argsSource.length) {
    if (i === argsSource.length || (argsSource[i] === "," && depth === 0)) {
      pushArg(argStart, i);
      argStart = i + 1;
      i++;
      continue;
    }
    const ch = argsSource[i];
    if (ch === '"' || ch === "'") {
      i = skipQuotedString(argsSource, i);
      continue;
    }
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    i++;
  }

  return { args, spans };
}

export interface ParsedLcdCall {
  method: string;
  args: string[];
  argSpans: ArgSpan[];
}

export function parseLcdCallWithSource(line: string, method: string): ParsedLcdCall | null {
  const normalized = line.replace(/\r$/, "");
  const marker = `lcd.${method}(`;
  const start = normalized.indexOf(marker);
  if (start < 0) return null;
  const open = start + marker.length - 1;
  const inner = extractParenContent(normalized, open);
  if (inner === null) return null;
  const innerStart = open + 1;
  const { args, spans } = splitCallArgsWithSpans(inner, innerStart);
  return { method, args, argSpans: spans };
}

function parseLcdCall(line: string, method: string): string[] | null {
  return parseLcdCallWithSource(line, method)?.args ?? null;
}

function makeSourceRef(parsed: ParsedLcdCall, sourceLine: number): DrawSourceRef {
  return { sourceLine, method: parsed.method, args: parsed.argSpans };
}

function buildLineSourceLookup(rawBody: string, bodyStartLine: number) {
  const byTrimmed = new Map<string, number[]>();
  rawBody.split("\n").forEach((text, index) => {
    const trimmed = text.replace(/\r$/, "").trim();
    if (!trimmed) return;
    const list = byTrimmed.get(trimmed) ?? [];
    list.push(bodyStartLine + index);
    byTrimmed.set(trimmed, list);
  });
  const nextIndex = new Map<string, number>();
  return {
    take(trimmed: string): number | undefined {
      const list = byTrimmed.get(trimmed);
      if (!list?.length) return undefined;
      const idx = nextIndex.get(trimmed) ?? 0;
      nextIndex.set(trimmed, idx + 1);
      return list[idx];
    },
  };
}

function attachSource(
  record: DrawRecord,
  parsed: ParsedLcdCall,
  sourceLine: number | undefined,
  indentOffset = 0
): DrawRecord {
  if (sourceLine === undefined) return record;
  const args =
    indentOffset === 0
      ? parsed.argSpans
      : parsed.argSpans.map((span) => ({
          start: span.start + indentOffset,
          end: span.end + indentOffset,
        }));
  return {
    ...record,
    sourceLine,
    sourceRef: { sourceLine, method: parsed.method, args },
  };
}

function indentOffsetForLine(rawBody: string, bodyStartLine: number, sourceLine: number | undefined): number {
  if (sourceLine === undefined) return 0;
  const line = rawBody.split("\n")[sourceLine - bodyStartLine]?.replace(/\r$/, "") ?? "";
  return line.length - line.trimStart().length;
}

/** Apply `if cond then name = expr end` on one line without rewriting the refresh body. */
function applySingleLineConditionalAssignments(
  body: string,
  ctx: EvalCtx,
  dims: EvalDims,
  srcMap: Map<string, string>,
  mock: MockTelemetry
): void {
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    const m = trimmed.match(/^if\s+(.+?)\s+then\s+(.+?)\s+end$/);
    if (!m) continue;

    const [, cond, stmt] = m;
    if (!evalBoolExpr(cond, ctx, dims)) continue;

    const assign = stmt.match(/^(\w+)\s*=\s*(.+)$/);
    if (!assign) continue;

    const [, name, expr] = assign;
    const value = evalValue(expr, ctx, dims, srcMap, mock);
    if (typeof value === "string" && looksLikeUnevaluated(value)) continue;
    if (typeof value === "string" && (value.includes("widget.") || value.includes("telem("))) continue;
    ctx[name] = value;
  }
}

function skipIfBlock(lines: string[], start: number): number {
  let depth = 1;
  let i = start;
  while (i < lines.length && depth > 0) {
    const t = lines[i].trim();
    if (/^if\s+.+\sthen\s*$/.test(t)) depth++;
    else if (t === "end") depth--;
    i++;
  }
  return i;
}

function processIfChain(
  lines: string[],
  start: number,
  ctx: EvalCtx,
  dims: EvalDims,
  initialTaken: boolean
): { out: string[]; next: number } {
  let i = start;
  let taken = initialTaken;
  let branchDone = initialTaken;
  const out: string[] = [];

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (trimmed === "end") {
      return { out, next: i + 1 };
    }

    const elseifMatch = trimmed.match(/^elseif\s+(.+)\sthen\s*$/);
    if (elseifMatch) {
      if (!branchDone) {
        taken = evalBoolExpr(elseifMatch[1], ctx, dims);
        if (taken) branchDone = true;
      } else {
        taken = false;
      }
      i++;
      continue;
    }

    if (trimmed === "else" || trimmed.startsWith("else ")) {
      if (!branchDone) {
        taken = true;
        branchDone = true;
      } else {
        taken = false;
      }
      i++;
      continue;
    }

    const ifMatch = trimmed.match(/^if\s+(.+)\sthen\s*$/);
    if (ifMatch) {
      if (taken) {
        const nested = processIfChain(lines, i + 1, ctx, dims, evalBoolExpr(ifMatch[1], ctx, dims));
        out.push(...nested.out);
        i = nested.next;
      } else {
        i = skipIfBlock(lines, i + 1);
      }
      continue;
    }

    if (taken) {
      out.push(lines[i]);
    }
    i++;
  }

  return { out, next: i };
}

function processConditionals(body: string, ctx: EvalCtx, dims: EvalDims): string {
  const lines = body.split("\n");
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const ifMatch = trimmed.match(/^if\s+(.+)\sthen\s*$/);
    if (ifMatch) {
      const result = processIfChain(lines, i + 1, ctx, dims, evalBoolExpr(ifMatch[1], ctx, dims));
      out.push(...result.out);
      i = result.next - 1;
      continue;
    }
    out.push(lines[i]);
  }

  return out.join("\n");
}

export interface PreviewStaticParse {
  body: string;
  dims: ReturnType<typeof resolvePreviewDimensions>;
  srcMap: Map<string, string>;
  rgbMap: Record<string, string>;
  evalDims: EvalDims;
}

/** Runs once per Lua source change — extracts refresh body and layout metadata. */
export function parseLuaToDrawCommandsStatic(source: string): PreviewStaticParse | null {
  try {
    const dims = resolvePreviewDimensions(source);
    const srcMap = buildSrcSensorMap(source);
    const rgbMap = buildRgbColorMap(source);
    const optionIndex = buildOptionIndexMap(source);
    const evalDims: EvalDims = {
      zoneW: dims.zoneW,
      zoneH: dims.zoneH,
      lcdW: dims.lcdW,
      lcdH: dims.lcdH,
      optionIndex,
    };
    const body = extractRefreshBody(source);
    return { body, dims, srcMap, rgbMap, evalDims };
  } catch {
    return null;
  }
}

/** Re-evaluates telemetry-dependent assignments and builds draw commands for the current mock. */
export function applyMockToCommands(
  staticParse: PreviewStaticParse,
  source: string,
  mockOrScenario: MockTelemetry | LayoutScenario = BASE_MOCK
): PreviewDrawCommand[] {
  const scenario: LayoutScenario =
    "mock" in mockOrScenario
      ? mockOrScenario
      : { id: "default", mock: mockOrScenario };
  const { body: rawBody, dims, srcMap, rgbMap, evalDims } = staticParse;
  const mock = scenario.mock;
  const commands: PreviewDrawCommand[] = [];
  const warnings: string[] = [];
  let skippedTextCount = 0;
  let zeroCoordCount = 0;
  const ctx = buildContext(source, mock);
  seedWidgetContext(source, ctx, scenario);

  let body = rawBody;
  for (let pass = 0; pass < 6; pass++) {
    collectTelemAssignments(body, ctx, evalDims, srcMap, mock);
    collectAssignments(body, ctx, evalDims, srcMap, mock);
    applySingleLineConditionalAssignments(body, ctx, evalDims, srcMap, mock);
    body = processConditionals(body, ctx, evalDims);
    collectAssignments(body, ctx, evalDims, srcMap, mock);
    applySingleLineConditionalAssignments(body, ctx, evalDims, srcMap, mock);
    collectAssignments(body, ctx, evalDims, srcMap, mock);
  }

  if (scenario.armed !== undefined) {
    ctx.armed = scenario.armed ? 1 : 0;
    body = processConditionals(rawBody, ctx, evalDims);
    for (let pass = 0; pass < 4; pass++) {
      collectTelemAssignments(body, ctx, evalDims, srcMap, mock);
      collectAssignments(body, ctx, evalDims, srcMap, mock);
      applySingleLineConditionalAssignments(body, ctx, evalDims, srcMap, mock);
    }
    ctx.armed = scenario.armed ? 1 : 0;
    if (scenario.armed) {
      ctx.bannerFill = "ORANGE";
    }
  }
  if (scenario.flightSecs !== undefined) {
    ctx.flightSecs = scenario.flightSecs;
    ctx.displaySecs = scenario.flightSecs;
  }

  const bodyStartLine = findRefreshBodyStartLine(source);
  const sourceLookup = buildLineSourceLookup(rawBody, bodyStartLine);
  const lines = body
    .split("\n")
    .map((l) => l.replace(/\r$/, "").trim())
    .filter(Boolean);

  let bg = "#000000";

  for (const line of lines) {
    const sourceLine = sourceLookup.take(line);
    const indent = indentOffsetForLine(rawBody, bodyStartLine, sourceLine);
    const attach = (record: DrawRecord, parsed: ParsedLcdCall) =>
      attachSource(record, parsed, sourceLine, indent);

    const clearParsed = parseLcdCallWithSource(line, "clear");
    if (clearParsed?.args.length === 1) {
      bg = resolveDrawColor(clearParsed.args[0]!, rgbMap, ctx);
      commands.push(attach({ kind: "clear", color: bg }, clearParsed));
      continue;
    }
    const textParsed = parseLcdCallWithSource(line, "drawText");
    if (textParsed && textParsed.args.length >= 3) {
      const textArgs = textParsed.args;
      const x = evalNumberExpr(textArgs[0]!, ctx, evalDims) + dims.zoneX;
      const y = evalNumberExpr(textArgs[1]!, ctx, evalDims) + dims.zoneY;
      const text = resolveTextTemplate(textArgs[2]!, ctx, evalDims, srcMap, mock);
      const flags = textArgs[3] ?? "0";
      if (isRenderableText(text)) {
        if (x === 0 && y === dims.zoneY) zeroCoordCount++;
        commands.push(
          attach(
            {
              kind: "text",
              x,
              y,
              text,
              color: resolveColor(flags, rgbMap, ctx),
              fontSize: resolveFontSize(flags),
              textAlign: resolveTextAlign(flags),
            },
            textParsed
          )
        );
      } else {
        skippedTextCount++;
        warnings.push(`Skipped unrenderable drawText: ${textArgs[2]!.trim().slice(0, 40)}`);
      }
      continue;
    }

    const lineParsed = parseLcdCallWithSource(line, "drawLine");
    if (lineParsed && lineParsed.args.length >= 5) {
      const lineArgs = lineParsed.args;
      const colorExpr = lineArgs.length >= 6 ? lineArgs[5]! : lineArgs[4]!;
      commands.push(
        attach(
          {
            kind: "line",
            x: evalNumberExpr(lineArgs[0]!, ctx, evalDims) + dims.zoneX,
            y: evalNumberExpr(lineArgs[1]!, ctx, evalDims) + dims.zoneY,
            x2: evalNumberExpr(lineArgs[2]!, ctx, evalDims) + dims.zoneX,
            y2: evalNumberExpr(lineArgs[3]!, ctx, evalDims) + dims.zoneY,
            color: resolveDrawColor(colorExpr, rgbMap, ctx),
          },
          lineParsed
        )
      );
      continue;
    }

    const bitmapParsed = parseLcdCallWithSource(line, "drawBitmap");
    if (bitmapParsed && bitmapParsed.args.length >= 3) {
      const bitmapArgs = bitmapParsed.args;
      commands.push(
        attach(
          {
            kind: "bitmap",
            x: evalNumberExpr(bitmapArgs[1]!, ctx, evalDims) + dims.zoneX,
            y: evalNumberExpr(bitmapArgs[2]!, ctx, evalDims) + dims.zoneY,
            w: 72,
            h: 56,
            placeholder: "model",
          },
          bitmapParsed
        )
      );
      continue;
    }

    const fillParsed = parseLcdCallWithSource(line, "drawFilledRectangle");
    if (fillParsed?.args.length === 5) {
      const fillArgs = fillParsed.args;
      commands.push(
        attach(
          {
            kind: "filledRect",
            x: evalNumberExpr(fillArgs[0]!, ctx, evalDims) + dims.zoneX,
            y: evalNumberExpr(fillArgs[1]!, ctx, evalDims) + dims.zoneY,
            w: evalNumberExpr(fillArgs[2]!, ctx, evalDims),
            h: evalNumberExpr(fillArgs[3]!, ctx, evalDims),
            color: resolveDrawColor(fillArgs[4]!, rgbMap, ctx),
          },
          fillParsed
        )
      );
      continue;
    }

    const rectParsed = parseLcdCallWithSource(line, "drawRectangle");
    if (rectParsed?.args.length === 5) {
      const rectArgs = rectParsed.args;
      commands.push(
        attach(
          {
            kind: "rect",
            x: evalNumberExpr(rectArgs[0]!, ctx, evalDims) + dims.zoneX,
            y: evalNumberExpr(rectArgs[1]!, ctx, evalDims) + dims.zoneY,
            w: evalNumberExpr(rectArgs[2]!, ctx, evalDims),
            h: evalNumberExpr(rectArgs[3]!, ctx, evalDims),
            color: resolveDrawColor(rectArgs[4]!, rgbMap, ctx),
          },
          rectParsed
        )
      );
      continue;
    }

    const gaugeParsed = parseLcdCallWithSource(line, "drawGauge");
    if (gaugeParsed && gaugeParsed.args.length >= 6) {
      const gaugeArgs = gaugeParsed.args;
      const flags = gaugeArgs.length >= 7 ? gaugeArgs[6]! : "CYAN";
      commands.push(
        attach(
          {
            kind: "gauge",
            x: evalNumberExpr(gaugeArgs[0]!, ctx, evalDims) + dims.zoneX,
            y: evalNumberExpr(gaugeArgs[1]!, ctx, evalDims) + dims.zoneY,
            w: evalNumberExpr(gaugeArgs[2]!, ctx, evalDims),
            h: evalNumberExpr(gaugeArgs[3]!, ctx, evalDims),
            fill: evalNumberExpr(gaugeArgs[4]!, ctx, evalDims),
            maxFill: evalNumberExpr(gaugeArgs[5]!, ctx, evalDims),
            color: resolveDrawColor(typeof flags === "string" ? flags : "CYAN", rgbMap, ctx),
          },
          gaugeParsed
        )
      );
      continue;
    }

    const circleParsed = parseLcdCallWithSource(line, "drawCircle");
    if (circleParsed && circleParsed.args.length >= 3) {
      const circleArgs = circleParsed.args;
      const flags = circleArgs[3] ?? "WHITE";
      commands.push(
        attach(
          {
            kind: "circle",
            x: evalNumberExpr(circleArgs[0]!, ctx, evalDims) + dims.zoneX,
            y: evalNumberExpr(circleArgs[1]!, ctx, evalDims) + dims.zoneY,
            r: evalNumberExpr(circleArgs[2]!, ctx, evalDims),
            color: resolveDrawColor(typeof flags === "string" ? flags : "WHITE", rgbMap, ctx),
          },
          circleParsed
        )
      );
      continue;
    }

    const filledCircleParsed = parseLcdCallWithSource(line, "drawFilledCircle");
    if (filledCircleParsed && filledCircleParsed.args.length >= 3) {
      const filledCircleArgs = filledCircleParsed.args;
      const flags = filledCircleArgs[3] ?? "WHITE";
      commands.push(
        attach(
          {
            kind: "filledCircle",
            x: evalNumberExpr(filledCircleArgs[0]!, ctx, evalDims) + dims.zoneX,
            y: evalNumberExpr(filledCircleArgs[1]!, ctx, evalDims) + dims.zoneY,
            r: evalNumberExpr(filledCircleArgs[2]!, ctx, evalDims),
            color: resolveDrawColor(typeof flags === "string" ? flags : "WHITE", rgbMap, ctx),
          },
          filledCircleParsed
        )
      );
      continue;
    }

    const arcParsed = parseLcdCallWithSource(line, "drawArc");
    if (arcParsed && arcParsed.args.length >= 5) {
      const arcArgs = arcParsed.args;
      const flags = arcArgs[5] ?? "WHITE";
      commands.push(
        attach(
          {
            kind: "arc",
            x: evalNumberExpr(arcArgs[0]!, ctx, evalDims) + dims.zoneX,
            y: evalNumberExpr(arcArgs[1]!, ctx, evalDims) + dims.zoneY,
            r: evalNumberExpr(arcArgs[2]!, ctx, evalDims),
            startAngle: evalNumberExpr(arcArgs[3]!, ctx, evalDims),
            endAngle: evalNumberExpr(arcArgs[4]!, ctx, evalDims),
            color: resolveDrawColor(typeof flags === "string" ? flags : "WHITE", rgbMap, ctx),
          },
          arcParsed
        )
      );
      continue;
    }

    const annulusParsed = parseLcdCallWithSource(line, "drawAnnulus");
    if (annulusParsed && annulusParsed.args.length >= 7) {
      const annulusArgs = annulusParsed.args;
      const flags = annulusArgs[7] ?? "CYAN";
      const r1 = evalNumberExpr(annulusArgs[2]!, ctx, evalDims);
      const r2 = evalNumberExpr(annulusArgs[3]!, ctx, evalDims);
      let rIn = Math.min(r1, r2);
      let rOut = Math.max(r1, r2);
      if (rIn <= 0 && rOut > 0) {
        rIn = Math.max(16, Math.floor(rOut * 0.77));
      }
      commands.push(
        attach(
          {
            kind: "annulus",
            x: evalNumberExpr(annulusArgs[0]!, ctx, evalDims) + dims.zoneX,
            y: evalNumberExpr(annulusArgs[1]!, ctx, evalDims) + dims.zoneY,
            rIn,
            rOut,
            startAngle: evalNumberExpr(annulusArgs[4]!, ctx, evalDims),
            endAngle: evalNumberExpr(annulusArgs[5]!, ctx, evalDims),
            color: resolveDrawColor(typeof flags === "string" ? flags : "CYAN", rgbMap, ctx),
          },
          annulusParsed
        )
      );
    }
  }

  if (commands.length === 0 || commands[0].kind !== "clear") {
    commands.unshift({ kind: "clear", color: bg });
  }

  lastPreviewParseMeta = { warnings, skippedTextCount, zeroCoordCount };
  return commands;
}

export function parseLuaToDrawCommands(
  source: string,
  mockOrScenario: MockTelemetry | LayoutScenario = BASE_MOCK
): PreviewDrawCommand[] {
  const staticParse = parseLuaToDrawCommandsStatic(source);
  if (!staticParse) return [];
  return applyMockToCommands(staticParse, source, mockOrScenario);
}

export function interpretWidgetLayout(
  source: string,
  scenario: LayoutScenario
): InterpretResult {
  const staticParse = parseLuaToDrawCommandsStatic(source);
  if (!staticParse) {
    return { records: [], warnings: ["Could not parse refresh() body"], skippedTextCount: 0, zeroCoordCount: 0 };
  }
  const records = applyMockToCommands(staticParse, source, scenario);
  const meta = getLastPreviewParseMeta();
  return {
    records,
    warnings: meta.warnings,
    skippedTextCount: meta.skippedTextCount,
    zeroCoordCount: meta.zeroCoordCount,
  };
}
