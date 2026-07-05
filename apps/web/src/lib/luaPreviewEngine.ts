import { resolvePreviewDimensions, extractRefreshBody } from "@widget-gen/shared";
import { BASE_MOCK, getMockForSensor, type MockTelemetry } from "./mockTelemetry";

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

export interface PreviewDrawCommand {
  kind: "clear" | "text" | "filledRect" | "rect" | "line" | "bitmap" | "gauge" | "circle" | "filledCircle" | "arc" | "annulus";
  color?: string;
  trackColor?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  r?: number;
  rIn?: number;
  rOut?: number;
  startAngle?: number;
  endAngle?: number;
  fill?: number;
  maxFill?: number;
  text?: string;
  fontSize?: number;
  textAlign?: "left" | "center" | "right";
  x2?: number;
  y2?: number;
  placeholder?: "model";
}

const FONT_SIZES: Record<string, number> = {
  SMLSIZE: 10,
  MIDSIZE: 14,
  DBLSIZE: 20,
};

type EvalCtx = Record<string, number | string>;
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
    e = e.replace(new RegExp(`\\b${k}\\b(?!\\.)`, "g"), String(ctx[k]));
  }
  return e;
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
  if (token in COLOR_MAP) return COLOR_MAP[token as EdgeColor];
  if (token in THEME_COLOR_MAP) return THEME_COLOR_MAP[token];
  if (rgbMap[token]) return rgbMap[token];
  if (token in ctx) {
    const resolved = String(ctx[token]);
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

function resolveDrawColor(colorExpr: string, rgbMap: Record<string, string>): string {
  const trimmed = colorExpr.trim();
  if (trimmed in COLOR_MAP) return COLOR_MAP[trimmed as EdgeColor];
  if (trimmed in THEME_COLOR_MAP) return THEME_COLOR_MAP[trimmed];
  if (rgbMap[trimmed]) return rgbMap[trimmed];
  return "#808080";
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
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

function seedWidgetContext(source: string, ctx: EvalCtx): void {
  for (const m of source.matchAll(/\{\s*"([^"]+)"\s*,\s*BOOL\s*,\s*(\d+)\s*\}/g)) {
    ctx[m[1]] = Number(m[2]);
  }
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

function evalFmtDuration(expr: string, ctx: EvalCtx, dims: EvalDims): string | null {
  const m = expr.match(/^fmtDuration\s*\(\s*(.+)\s*\)$/);
  if (!m) return null;
  const sec = Math.floor(evalNumberExpr(m[1], ctx, dims) + 0.5);
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
): string | number | null {
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
): string | number | null {
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
): string | number {
  const expr = stripOuterParens(raw.trim().replace(/,\s*$/, ""));

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

  const ternaryVal = evalTernary(expr, ctx, dims, srcMap, mock);
  if (ternaryVal !== null) return ternaryVal;

  const tostringM = expr.match(/^tostring\s*\(\s*(.+)\s*\)$/);
  if (tostringM) {
    const inner = evalValue(tostringM[1], ctx, dims, srcMap, mock);
    return String(inner);
  }

  if (expr in ctx) {
    return ctx[expr];
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
    if (expr.startsWith("function") || expr.startsWith("{")) return false;
    if (/^widget\.\w+$/.test(expr.trim())) return false;

    const value = evalValue(expr, ctx, dims, srcMap, mock);
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

function parseLcdCall(line: string, method: string): string[] | null {
  const marker = `lcd.${method}(`;
  const start = line.indexOf(marker);
  if (start < 0) return null;
  const open = start + marker.length - 1;
  const inner = extractParenContent(line, open);
  if (inner === null) return null;
  return splitCallArgs(inner);
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
  mock: MockTelemetry = BASE_MOCK
): PreviewDrawCommand[] {
  const { body: rawBody, dims, srcMap, rgbMap, evalDims } = staticParse;
  const commands: PreviewDrawCommand[] = [];
  const warnings: string[] = [];
  let skippedTextCount = 0;
  let zeroCoordCount = 0;
  const ctx = buildContext(source, mock);
  seedWidgetContext(source, ctx);

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

  const lines = body
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let bg = "#000000";

  for (const line of lines) {
    const clearArgs = parseLcdCall(line, "clear");
    if (clearArgs?.length === 1) {
      bg = resolveDrawColor(clearArgs[0], rgbMap);
      commands.push({ kind: "clear", color: bg });
      continue;
    }

    const textArgs = parseLcdCall(line, "drawText");
    if (textArgs && textArgs.length >= 3) {
      const x = evalNumberExpr(textArgs[0], ctx, evalDims) + dims.zoneX;
      const y = evalNumberExpr(textArgs[1], ctx, evalDims) + dims.zoneY;
      const text = resolveTextTemplate(textArgs[2], ctx, evalDims, srcMap, mock);
      const flags = textArgs[3] ?? "0";
      if (isRenderableText(text)) {
        if (x === 0 && y === dims.zoneY) zeroCoordCount++;
        commands.push({
          kind: "text",
          x,
          y,
          text,
          color: resolveColor(flags, rgbMap, ctx),
          fontSize: resolveFontSize(flags),
          textAlign: resolveTextAlign(flags),
        });
      } else {
        skippedTextCount++;
        warnings.push(`Skipped unrenderable drawText: ${textArgs[2].trim().slice(0, 40)}`);
      }
      continue;
    }

    const lineArgs = parseLcdCall(line, "drawLine");
    if (lineArgs && lineArgs.length >= 5) {
      const colorExpr = lineArgs.length >= 6 ? lineArgs[5] : lineArgs[4];
      commands.push({
        kind: "line",
        x: evalNumberExpr(lineArgs[0], ctx, evalDims) + dims.zoneX,
        y: evalNumberExpr(lineArgs[1], ctx, evalDims) + dims.zoneY,
        x2: evalNumberExpr(lineArgs[2], ctx, evalDims) + dims.zoneX,
        y2: evalNumberExpr(lineArgs[3], ctx, evalDims) + dims.zoneY,
        color: resolveDrawColor(colorExpr, rgbMap),
      });
      continue;
    }

    const bitmapArgs = parseLcdCall(line, "drawBitmap");
    if (bitmapArgs && bitmapArgs.length >= 3) {
      commands.push({
        kind: "bitmap",
        x: evalNumberExpr(bitmapArgs[1], ctx, evalDims) + dims.zoneX,
        y: evalNumberExpr(bitmapArgs[2], ctx, evalDims) + dims.zoneY,
        w: 72,
        h: 56,
        placeholder: "model",
      });
      continue;
    }

    const fillArgs = parseLcdCall(line, "drawFilledRectangle");
    if (fillArgs?.length === 5) {
      commands.push({
        kind: "filledRect",
        x: evalNumberExpr(fillArgs[0], ctx, evalDims) + dims.zoneX,
        y: evalNumberExpr(fillArgs[1], ctx, evalDims) + dims.zoneY,
        w: evalNumberExpr(fillArgs[2], ctx, evalDims),
        h: evalNumberExpr(fillArgs[3], ctx, evalDims),
        color: resolveDrawColor(fillArgs[4], rgbMap),
      });
      continue;
    }

    const rectArgs = parseLcdCall(line, "drawRectangle");
    if (rectArgs?.length === 5) {
      commands.push({
        kind: "rect",
        x: evalNumberExpr(rectArgs[0], ctx, evalDims) + dims.zoneX,
        y: evalNumberExpr(rectArgs[1], ctx, evalDims) + dims.zoneY,
        w: evalNumberExpr(rectArgs[2], ctx, evalDims),
        h: evalNumberExpr(rectArgs[3], ctx, evalDims),
        color: resolveDrawColor(rectArgs[4], rgbMap),
      });
      continue;
    }

    const gaugeArgs = parseLcdCall(line, "drawGauge");
    if (gaugeArgs && gaugeArgs.length >= 6) {
      const flags = gaugeArgs.length >= 7 ? gaugeArgs[6] : "CYAN";
      commands.push({
        kind: "gauge",
        x: evalNumberExpr(gaugeArgs[0], ctx, evalDims) + dims.zoneX,
        y: evalNumberExpr(gaugeArgs[1], ctx, evalDims) + dims.zoneY,
        w: evalNumberExpr(gaugeArgs[2], ctx, evalDims),
        h: evalNumberExpr(gaugeArgs[3], ctx, evalDims),
        fill: evalNumberExpr(gaugeArgs[4], ctx, evalDims),
        maxFill: evalNumberExpr(gaugeArgs[5], ctx, evalDims),
        color: resolveDrawColor(typeof flags === "string" ? flags : "CYAN", rgbMap),
      });
      continue;
    }

    const circleArgs = parseLcdCall(line, "drawCircle");
    if (circleArgs && circleArgs.length >= 3) {
      const flags = circleArgs[3] ?? "WHITE";
      commands.push({
        kind: "circle",
        x: evalNumberExpr(circleArgs[0], ctx, evalDims) + dims.zoneX,
        y: evalNumberExpr(circleArgs[1], ctx, evalDims) + dims.zoneY,
        r: evalNumberExpr(circleArgs[2], ctx, evalDims),
        color: resolveDrawColor(typeof flags === "string" ? flags : "WHITE", rgbMap),
      });
      continue;
    }

    const filledCircleArgs = parseLcdCall(line, "drawFilledCircle");
    if (filledCircleArgs && filledCircleArgs.length >= 3) {
      const flags = filledCircleArgs[3] ?? "WHITE";
      commands.push({
        kind: "filledCircle",
        x: evalNumberExpr(filledCircleArgs[0], ctx, evalDims) + dims.zoneX,
        y: evalNumberExpr(filledCircleArgs[1], ctx, evalDims) + dims.zoneY,
        r: evalNumberExpr(filledCircleArgs[2], ctx, evalDims),
        color: resolveDrawColor(typeof flags === "string" ? flags : "WHITE", rgbMap),
      });
      continue;
    }

    const arcArgs = parseLcdCall(line, "drawArc");
    if (arcArgs && arcArgs.length >= 5) {
      const flags = arcArgs[5] ?? "WHITE";
      commands.push({
        kind: "arc",
        x: evalNumberExpr(arcArgs[0], ctx, evalDims) + dims.zoneX,
        y: evalNumberExpr(arcArgs[1], ctx, evalDims) + dims.zoneY,
        r: evalNumberExpr(arcArgs[2], ctx, evalDims),
        startAngle: evalNumberExpr(arcArgs[3], ctx, evalDims),
        endAngle: evalNumberExpr(arcArgs[4], ctx, evalDims),
        color: resolveDrawColor(typeof flags === "string" ? flags : "WHITE", rgbMap),
      });
      continue;
    }

    const annulusArgs = parseLcdCall(line, "drawAnnulus");
    if (annulusArgs && annulusArgs.length >= 7) {
      const flags = annulusArgs[7] ?? "CYAN";
      commands.push({
        kind: "annulus",
        x: evalNumberExpr(annulusArgs[0], ctx, evalDims) + dims.zoneX,
        y: evalNumberExpr(annulusArgs[1], ctx, evalDims) + dims.zoneY,
        rOut: evalNumberExpr(annulusArgs[2], ctx, evalDims),
        rIn: evalNumberExpr(annulusArgs[3], ctx, evalDims),
        startAngle: evalNumberExpr(annulusArgs[4], ctx, evalDims),
        endAngle: evalNumberExpr(annulusArgs[5], ctx, evalDims),
        color: resolveDrawColor(typeof flags === "string" ? flags : "CYAN", rgbMap),
      });
    }
  }

  if (commands.length === 0 || commands[0].kind !== "clear") {
    commands.unshift({ kind: "clear", color: bg });
  }

  lastPreviewParseMeta = { warnings, skippedTextCount, zeroCoordCount };
  return commands;
}

export function parseLuaToDrawCommands(source: string, mock: MockTelemetry = BASE_MOCK): PreviewDrawCommand[] {
  const staticParse = parseLuaToDrawCommandsStatic(source);
  if (!staticParse) return [];
  return applyMockToCommands(staticParse, source, mock);
}

export function renderPreviewCommands(
  ctx: CanvasRenderingContext2D,
  commands: PreviewDrawCommand[],
  scale: number,
  lcdW = 480,
  lcdH = 320
): void {
  ctx.save();
  ctx.scale(scale, scale);

  for (const cmd of commands) {
    switch (cmd.kind) {
      case "clear":
        ctx.fillStyle = cmd.color ?? "#000000";
        ctx.fillRect(0, 0, lcdW, lcdH);
        break;
      case "filledRect":
        ctx.fillStyle = cmd.color ?? "#808080";
        ctx.fillRect(cmd.x ?? 0, cmd.y ?? 0, cmd.w ?? 0, cmd.h ?? 0);
        break;
      case "rect":
        ctx.strokeStyle = cmd.color ?? "#ffffff";
        ctx.lineWidth = 1;
        ctx.strokeRect(cmd.x ?? 0, cmd.y ?? 0, cmd.w ?? 0, cmd.h ?? 0);
        break;
      case "line":
        ctx.strokeStyle = cmd.color ?? "#ffffff";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cmd.x ?? 0, cmd.y ?? 0);
        ctx.lineTo(cmd.x2 ?? 0, cmd.y2 ?? 0);
        ctx.stroke();
        break;
      case "text": {
        ctx.fillStyle = cmd.color ?? "#ffffff";
        ctx.font = `bold ${cmd.fontSize ?? 12}px monospace`;
        const fontSize = cmd.fontSize ?? 12;
        const text = cmd.text ?? "";
        const align = cmd.textAlign ?? "left";
        const textY = (cmd.y ?? 0) + fontSize;
        const textX = cmd.x ?? 0;
        if (align === "center") {
          ctx.textAlign = "center";
          ctx.fillText(text, textX, textY);
        } else if (align === "right") {
          ctx.textAlign = "right";
          ctx.fillText(text, textX, textY);
        } else {
          ctx.textAlign = "left";
          ctx.fillText(text, textX, textY);
        }
        ctx.textAlign = "left";
        break;
      }
      case "bitmap": {
        const bx = cmd.x ?? 0;
        const by = cmd.y ?? 0;
        const bw = cmd.w ?? 72;
        const bh = cmd.h ?? 56;
        ctx.fillStyle = "#2a2a32";
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = "#606070";
        ctx.lineWidth = 1;
        ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
        ctx.fillStyle = "#9090a0";
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.fillText("MODEL", bx + bw / 2, by + bh / 2 + 3);
        ctx.textAlign = "left";
        break;
      }
      case "gauge": {
        const gx = cmd.x ?? 0;
        const gy = cmd.y ?? 0;
        const gw = cmd.w ?? 0;
        const gh = cmd.h ?? 0;
        const max = cmd.maxFill && cmd.maxFill > 0 ? cmd.maxFill : 100;
        const ratio = Math.max(0, Math.min(1, (cmd.fill ?? 0) / max));
        ctx.strokeStyle = "#606070";
        ctx.lineWidth = 1;
        ctx.strokeRect(gx + 0.5, gy + 0.5, gw - 1, gh - 1);
        const fillH = Math.max(0, Math.floor(gh * ratio));
        if (fillH > 0) {
          ctx.fillStyle = cmd.color ?? "#00ffff";
          ctx.fillRect(gx + 1, gy + gh - fillH, gw - 2, fillH);
        }
        break;
      }
      case "circle": {
        const cx = cmd.x ?? 0;
        const cy = cmd.y ?? 0;
        const r = cmd.r ?? 0;
        ctx.strokeStyle = cmd.color ?? "#ffffff";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case "filledCircle": {
        const cx = cmd.x ?? 0;
        const cy = cmd.y ?? 0;
        const r = cmd.r ?? 0;
        ctx.fillStyle = cmd.color ?? "#808080";
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "arc": {
        const cx = cmd.x ?? 0;
        const cy = cmd.y ?? 0;
        const r = cmd.r ?? 0;
        ctx.strokeStyle = cmd.color ?? "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, degToRad(cmd.startAngle ?? 0), degToRad(cmd.endAngle ?? 360));
        ctx.stroke();
        break;
      }
      case "annulus": {
        const cx = cmd.x ?? 0;
        const cy = cmd.y ?? 0;
        const rOut = cmd.rOut ?? 0;
        const rIn = cmd.rIn ?? 0;
        const midR = (rOut + rIn) / 2;
        const width = Math.max(1, rOut - rIn);
        ctx.strokeStyle = cmd.color ?? "#00ffff";
        ctx.lineWidth = width;
        ctx.lineCap = "butt";
        ctx.beginPath();
        ctx.arc(cx, cy, midR, degToRad(cmd.startAngle ?? 0), degToRad(cmd.endAngle ?? 360));
        ctx.stroke();
        break;
      }
    }
  }

  ctx.restore();
}
