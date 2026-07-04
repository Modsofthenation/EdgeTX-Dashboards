import { resolvePreviewDimensions, extractRefreshBody } from "@widget-gen/shared";
import { BASE_MOCK, getMockForSensor, type MockTelemetry } from "./mockTelemetry";

export type EdgeColor =
  | "WHITE"
  | "BLACK"
  | "GREY"
  | "RED"
  | "GREEN"
  | "BLUE"
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
  RED: "#ff0000",
  GREEN: "#00ff00",
  BLUE: "#0000ff",
  YELLOW: "#ffff00",
  ORANGE: "#ff8800",
  LIME: "#88ff00",
  CYAN: "#00ffff",
  MAGENTA: "#ff00ff",
  DARKGREY: "#404040",
};

export interface PreviewDrawCommand {
  kind: "clear" | "text" | "filledRect" | "rect" | "line";
  color?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  text?: string;
  fontSize?: number;
  x2?: number;
  y2?: number;
}

const FONT_SIZES: Record<string, number> = {
  SMLSIZE: 10,
  MIDSIZE: 14,
  DBLSIZE: 20,
};

type EvalCtx = Record<string, number | string>;
type EvalDims = { zoneW: number; zoneH: number; lcdW: number; lcdH: number };

function buildSrcSensorMap(source: string): Map<string, string> {
  const map = new Map<string, string>();
  const createBlock = source.match(/src\s*=\s*\{([\s\S]*?)\}/);
  if (!createBlock) return map;

  for (const m of createBlock[1].matchAll(/(\w+)\s*=\s*cacheSource\s*\(\s*"([^"]+)"\s*\)/g)) {
    map.set(m[1], m[2]);
  }
  return map;
}

function resolveColor(flags: string, fallback = "#ffffff"): string {
  for (const c of Object.keys(COLOR_MAP) as EdgeColor[]) {
    if (flags.includes(c)) return COLOR_MAP[c];
  }
  return fallback;
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

function stripElseBranches(body: string): string {
  const lines = body.split("\n");
  const out: string[] = [];
  let skippingElse = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (skippingElse > 0) {
      if (/^\s*else\b/.test(line) || /^\s*elseif\b/.test(line)) continue;
      if (/^\s*end\b/.test(line)) {
        skippingElse--;
        continue;
      }
      continue;
    }
    if (/^\s*else\b/.test(line)) {
      skippingElse = 1;
      continue;
    }
    out.push(line);
  }

  return out.join("\n");
}

function stripConditionals(body: string): string {
  const enabled = body.replace(/\bif\b[^\n]*\bthen\b/g, "if true then");
  return stripElseBranches(enabled);
}

export function parseLuaToDrawCommands(source: string, mock: MockTelemetry = BASE_MOCK): PreviewDrawCommand[] {
  const commands: PreviewDrawCommand[] = [];
  const dims = resolvePreviewDimensions(source);
  const evalDims: EvalDims = {
    zoneW: dims.zoneW,
    zoneH: dims.zoneH,
    lcdW: dims.lcdW,
    lcdH: dims.lcdH,
  };
  const srcMap = buildSrcSensorMap(source);
  const body = stripConditionals(extractRefreshBody(source));
  const ctx = buildContext(source, mock);

  collectAssignments(body, ctx, evalDims, srcMap, mock);

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
          color: resolveColor(flags),
          fontSize: resolveFontSize(flags),
        });
      }
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
        color: COLOR_MAP[fillArgs[4] as EdgeColor] ?? "#808080",
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
        color: COLOR_MAP[rectArgs[4] as EdgeColor] ?? "#ffffff",
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
      case "text":
        ctx.fillStyle = cmd.color ?? "#ffffff";
        ctx.font = `bold ${cmd.fontSize ?? 12}px monospace`;
        ctx.fillText(cmd.text ?? "", cmd.x ?? 0, (cmd.y ?? 0) + (cmd.fontSize ?? 12));
        break;
    }
  }

  ctx.restore();
}
