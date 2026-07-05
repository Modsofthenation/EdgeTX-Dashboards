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
  kind: "clear" | "text" | "filledRect" | "rect" | "line" | "bitmap" | "gauge" | "circle" | "arc" | "annulus";
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

function buildSrcSensorMap(source: string): Map<string, string> {
  const map = new Map<string, string>();
  const createBlock = source.match(/src\s*=\s*\{([\s\S]*?)\}/);
  if (!createBlock) return map;

  for (const m of createBlock[1].matchAll(/(\w+)\s*=\s*cacheSource\s*\(\s*"([^"]+)"\s*\)/g)) {
    map.set(m[1], m[2]);
  }
  return map;
}

function resolveColor(flags: string, rgbMap: Record<string, string>, fallback = "#ffffff"): string {
  for (const c of Object.keys(COLOR_MAP) as EdgeColor[]) {
    if (flags.includes(c)) return COLOR_MAP[c];
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

function buildRgbColorMap(source: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const m of source.matchAll(
    /local\s+(\w+)\s*=\s*lcd\.RGB\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g
  )) {
    const r = Number(m[2]);
    const g = Number(m[3]);
    const b = Number(m[4]);
    map[m[1]] = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
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
  e = e.replace(/\bLCD_W\b/g, String(dims.lcdW));
  e = e.replace(/\bLCD_H\b/g, String(dims.lcdH));
  e = e.replace(/\bw\b/g, String(dims.zoneW));
  e = e.replace(/\bh\b/g, String(dims.zoneH));
  e = e.replace(/~=/g, "!=");
  e = e.replace(/type\s*\(\s*(\w+)\s*\)\s*==\s*"string"/g, (_, name) =>
    typeof ctx[name] === "string" ? "true" : "false"
  );
  e = e.replace(/type\s*\(\s*(\w+)\s*\)\s*==\s*"number"/g, (_, name) =>
    typeof ctx[name] === "number" ? "true" : "false"
  );
  for (const [k, v] of Object.entries(ctx)) {
    if (typeof v === "number") {
      e = e.replace(new RegExp(`\\b${k}\\b`, "g"), String(v));
    } else if (typeof v === "string") {
      e = e.replace(new RegExp(`\\b${k}\\b`, "g"), JSON.stringify(v));
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
  e = e.replace(/\bLCD_W\b/g, String(dims.lcdW));
  e = e.replace(/\bLCD_H\b/g, String(dims.lcdH));
  e = e.replace(/\bw\b/g, String(dims.zoneW));
  e = e.replace(/\bh\b/g, String(dims.zoneH));
  for (const [k, v] of Object.entries(ctx)) {
    if (typeof v === "number") {
      e = e.replace(new RegExp(`\\b${k}\\b`, "g"), String(v));
    }
  }
  e = replaceMathCalls(e, ctx, dims);
  e = e.replace(/~=/g, "!=");
  if (/[<>=!]/.test(e) || /\band\b|\bor\b/.test(e)) {
    try {
      return evalBoolExpr(e, ctx, dims) ? 1 : 0;
    } catch {
      return 0;
    }
  }
  if (/^[\d\s+\-*/().]+$/.test(e)) {
    try {
      return Function(`"use strict"; return (${e})`)() as number;
    } catch {
      return 0;
    }
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
  const argExpr = inner.slice(quoteEnd + 1).replace(/^,\s*/, "").trim();
  if (!argExpr) return null;

  const arg = evalNumberExpr(argExpr, ctx, dims);
  let out = fmt;
  out = out.replace(/%\.(\d+)f/g, (_, digits) => arg.toFixed(Number(digits)));
  out = out.replace(/%d/g, String(Math.round(arg)));
  return out;
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

  if (expr === "LCD_W") return dims.lcdW;
  if (expr === "LCD_H") return dims.lcdH;

  if (/^"[^"]*"$/.test(expr) || /^'[^']*'$/.test(expr)) {
    return expr.slice(1, -1);
  }

  if (/^[\d.]+$/.test(expr)) {
    return Number(expr);
  }

  if (/^[\w\s\d.+\-*/()]+$/.test(expr)) {
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

function collectAssignments(
  body: string,
  ctx: EvalCtx,
  dims: EvalDims,
  srcMap: Map<string, string>,
  mock: MockTelemetry
): void {
  for (let pass = 0; pass < 6; pass++) {
    for (const line of body.split("\n")) {
      const trimmed = line.trim();
      const localMatch = trimmed.match(/^(?:local\s+)?(\w+)\s*=\s*(.+)$/);
      if (!localMatch) continue;

      const [, name, expr] = localMatch;
      if (expr.startsWith("function") || expr.startsWith("{")) continue;

      const value = evalValue(expr, ctx, dims, srcMap, mock);
      if (typeof value === "string" && looksLikeUnevaluated(value)) continue;
      if (typeof value === "string" && (value.includes("widget.") || value.includes("telem("))) {
        continue;
      }
      if (typeof value === "string" && value.includes("..")) continue;
      ctx[name] = value;
    }
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

function processConditionals(body: string, ctx: EvalCtx, dims: EvalDims): string {
  const lines = body.split("\n");
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    const ifMatch = trimmed.match(/^if\s+(.+)\sthen\s*$/);
    if (ifMatch) {
      let taken = evalBoolExpr(ifMatch[1], ctx, dims);
      i++;
      while (i < lines.length) {
        const inner = lines[i];
        const innerTrim = inner.trim();
        if (innerTrim === "end") break;

        const elseifMatch = innerTrim.match(/^elseif\s+(.+)\sthen\s*$/);
        if (elseifMatch) {
          if (!taken) {
            taken = evalBoolExpr(elseifMatch[1], ctx, dims);
          }
          i++;
          continue;
        }

        if (innerTrim === "else" || innerTrim.startsWith("else ")) {
          if (!taken) taken = true;
          else taken = false;
          i++;
          continue;
        }

        if (taken) out.push(inner);
        i++;
      }
      continue;
    }

    out.push(line);
  }

  return out.join("\n");
}

export function parseLuaToDrawCommands(source: string, mock: MockTelemetry = BASE_MOCK): PreviewDrawCommand[] {
  const commands: PreviewDrawCommand[] = [];
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
  const ctx = buildContext(source, mock);
  seedWidgetContext(source, ctx);

  let body = extractRefreshBody(source);
  for (let pass = 0; pass < 6; pass++) {
    collectAssignments(body, ctx, evalDims, srcMap, mock);
    body = processConditionals(body, ctx, evalDims);
  }

  const lines = body
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let bg = "#000000";

  for (const line of lines) {
    const clearArgs = parseLcdCall(line, "clear");
    if (clearArgs?.length === 1) {
      bg = COLOR_MAP[clearArgs[0] as EdgeColor] ?? "#000000";
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
        commands.push({
          kind: "text",
          x,
          y,
          text,
          color: resolveColor(flags, rgbMap),
          fontSize: resolveFontSize(flags),
          textAlign: resolveTextAlign(flags),
        });
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

  return commands;
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
