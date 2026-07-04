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

function buildSensorVarMap(source: string): Map<string, string> {
  const map = new Map<string, string>();
  const createBlock = source.match(/local function create[\s\S]*?\n([\s\S]*?)\nend/);
  if (!createBlock) return map;

  for (const m of createBlock[1].matchAll(/(\w+)\s*=\s*cacheSource\s*\(\s*"([^"]+)"\s*\)/g)) {
    map.set(m[1], m[2]);
  }
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

function evalExpr(
  expr: string,
  ctx: Record<string, number | string>,
  dims: { zoneW: number; zoneH: number; lcdW: number; lcdH: number }
): number {
  let e = expr.trim();
  e = e.replace(/\bLCD_W\b/g, String(dims.lcdW));
  e = e.replace(/\bLCD_H\b/g, String(dims.lcdH));
  e = e.replace(/\bw\b/g, String(dims.zoneW));
  e = e.replace(/\bh\b/g, String(dims.zoneH));
  for (const [k, v] of Object.entries(ctx)) {
    e = e.replace(new RegExp(`\\b${k}\\b`, "g"), String(v));
  }
  e = e.replace(/math\.floor\s*\(([^)]+)\)/g, (_, inner) =>
    String(Math.floor(evalExpr(inner, ctx, dims)))
  );
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

function resolveTextTemplate(
  template: string,
  ctx: Record<string, number | string>,
  dims = { zoneW: 480, zoneH: 320, lcdW: 480, lcdH: 320 }
): string {
  let t = template;

  t = t.replace(/string\.format\s*\(\s*"([^"]*)"\s*,\s*([^)]+)\)/g, (_, fmt, arg) => {
    const val = evalExpr(String(arg).trim(), ctx as Record<string, number>, dims);
    if (fmt.includes("%.1f")) return fmt.replace("%.1f", Number(val).toFixed(1));
    if (fmt.includes("%.0f")) return fmt.replace("%.0f", String(Math.round(Number(val))));
    return String(val);
  });

  t = t.replace(/"([^"]*)"\s*\.\.\s*tostring\s*\(\s*(\w+)\s*\)\s*\.\.\s*"([^"]*)"/g, (_, pre, varName, post) => {
    const val = ctx[varName] ?? 0;
    return `${pre}${val}${post}`;
  });

  t = t.replace(/"([^"]*)"\s*\.\.\s*tostring\s*\(\s*(\w+)\s*\)/g, (_, pre, varName) => {
    const val = ctx[varName] ?? 0;
    return `${pre}${val}`;
  });

  t = t.replace(/^"([^"]*)"$/, "$1");
  return t.replace(/\\n/g, "\n");
}

function buildContext(source: string, mock: MockTelemetry): Record<string, number | string> {
  const ctx: Record<string, number | string> = { ...mock };
  const sensorVars = buildSensorVarMap(source);

  for (const [varName, sensorName] of sensorVars) {
    ctx[varName] = getMockForSensor(sensorName, mock);
  }

  for (const m of source.matchAll(/local\s+(\w+)\s*=\s*telem\s*\(\s*widget\.(?:src|sources)\.(\w+)\s*\)/g)) {
    const localVar = m[1];
    const srcKey = m[2];
    const sensor = sensorVars.get(srcKey);
    if (sensor) ctx[localVar] = getMockForSensor(sensor, mock);
  }

  for (const m of source.matchAll(/local\s+(\w+)\s*=\s*telem\s*\(\s*widget\.(?:src|sources)\.(\w+)\s*\)/g)) {
    ctx[m[1]] = ctx[m[2]] ?? ctx[m[1]];
  }

  ctx.rqly = ctx.RQLY ?? mock.RQLY;
  ctx.rssi = ctx["1RSS"] ?? mock["1RSS"];
  ctx.v = ctx.RxBt ?? mock.RxBt;
  ctx.a = ctx.Curr ?? mock.Curr;
  ctx.fm = ctx.FM ?? mock.FM;

  return ctx;
}

function stripConditionals(body: string): string {
  let out = body;
  out = out.replace(/if\s+widget\.options\.\w+\s*==\s*1\s+then/g, "if true then");
  out = out.replace(/if\s+type\s*\(\s*fm\s*\)\s*==\s*"string"\s+then/g, "if true then");
  out = out.replace(/if\s+barW\s*>\s*0\s+then/g, "if true then");
  return out;
}

export function parseLuaToDrawCommands(source: string, mock: MockTelemetry = BASE_MOCK): PreviewDrawCommand[] {
  const commands: PreviewDrawCommand[] = [];
  const dims = resolvePreviewDimensions(source);
  const evalDims = {
    zoneW: dims.zoneW,
    zoneH: dims.zoneH,
    lcdW: dims.lcdW,
    lcdH: dims.lcdH,
  };
  const body = stripConditionals(extractRefreshBody(source));
  const ctx: Record<string, number | string> = { ...buildContext(source, mock) };

  const lines = body
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let bg = "#000000";

  for (const line of lines) {
    const localNum = line.match(/^local\s+(\w+)\s*=\s*(.+)$/);
    if (localNum) {
      const val = localNum[2];
      if (val.includes("telem(")) {
        const keyMatch = val.match(/widget\.(?:src|sources)\.(\w+)/);
        if (keyMatch) {
          const sensorVars = buildSensorVarMap(source);
          const sensor = sensorVars.get(keyMatch[1]);
          ctx[localNum[1]] = sensor ? getMockForSensor(sensor, mock) : 0;
        }
      } else if (val.includes("string.format")) {
        ctx[localNum[1]] = resolveTextTemplate(val, ctx);
      } else {
        ctx[localNum[1]] = evalExpr(val, ctx, evalDims);
      }
      continue;
    }

    const clearMatch = line.match(/lcd\.clear\s*\(\s*(\w+)\s*\)/);
    if (clearMatch) {
      bg = COLOR_MAP[clearMatch[1] as EdgeColor] ?? "#000000";
      commands.push({ kind: "clear", color: bg });
      continue;
    }

    const textMatch = line.match(/lcd\.drawText\s*\(\s*([^,]+),\s*([^,]+),\s*([^,]+)(?:,\s*([^)]+))?\)/);
    if (textMatch) {
      const x = evalExpr(textMatch[1], ctx, evalDims) + dims.zoneX;
      const y = evalExpr(textMatch[2], ctx, evalDims) + dims.zoneY;
      const text = resolveTextTemplate(textMatch[3].trim(), ctx, evalDims);
      const flags = textMatch[4] ?? "0";
      if (text && !text.includes("widget.") && !text.includes("telem(")) {
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

    const fillMatch = line.match(
      /lcd\.drawFilledRectangle\s*\(\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*(\w+)\s*\)/
    );
    if (fillMatch) {
      commands.push({
        kind: "filledRect",
        x: evalExpr(fillMatch[1], ctx, evalDims) + dims.zoneX,
        y: evalExpr(fillMatch[2], ctx, evalDims) + dims.zoneY,
        w: evalExpr(fillMatch[3], ctx, evalDims),
        h: evalExpr(fillMatch[4], ctx, evalDims),
        color: COLOR_MAP[fillMatch[5] as EdgeColor] ?? "#808080",
      });
      continue;
    }

    const rectMatch = line.match(
      /lcd\.drawRectangle\s*\(\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*(\w+)\s*\)/
    );
    if (rectMatch) {
      commands.push({
        kind: "rect",
        x: evalExpr(rectMatch[1], ctx, evalDims) + dims.zoneX,
        y: evalExpr(rectMatch[2], ctx, evalDims) + dims.zoneY,
        w: evalExpr(rectMatch[3], ctx, evalDims),
        h: evalExpr(rectMatch[4], ctx, evalDims),
        color: COLOR_MAP[rectMatch[5] as EdgeColor] ?? "#ffffff",
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
