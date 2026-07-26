/**
 * Shared TX15 lcd preview → canvas helpers for bake scripts.
 */
import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import {
  EDITOR_PREVIEW_SCENARIO,
  parseLuaToDrawCommands,
  type PreviewDrawCommand,
} from "../../packages/layout-verify/src/index.ts";

export const LCD_W = 480;
export const LCD_H = 320;

export const PREFAB_SHELL = `---@type WidgetScript
---@simulate Layout1x1 zone=0
local name = "Thumb"
local options = {}
local function cacheSource(sensorName)
  local idx = getSourceIndex(sensorName)
  if idx and idx > 0 then return idx end
  return nil
end
local function telem(id)
  if id then return getValue(id) end
  return 0
end
local function create(zone, opts)
  return { zone = zone, options = opts, src = {} }
end
local function refresh(widget)
  lcd.clear(BLACK)
end
return {
  name = name,
  options = options,
  create = create,
  refresh = refresh,
}
`;

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function fillPreviewText(
  ctx: SKRSContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  align: "left" | "center" | "right",
): void {
  ctx.font = `bold ${fontSize}px monospace`;
  ctx.textBaseline = "top";
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

export function renderPreviewCommands(
  ctx: SKRSContext2D,
  commands: PreviewDrawCommand[],
  scale: number,
  lcdW: number,
  lcdH: number,
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
        const fontSize = cmd.fontSize ?? 12;
        const text = cmd.text ?? "";
        const align =
          cmd.textAlign === "center" || cmd.textAlign === "right"
            ? cmd.textAlign
            : "left";
        fillPreviewText(ctx, text, cmd.x ?? 0, cmd.y ?? 0, fontSize, align);
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
        const r = Math.max(0, cmd.r ?? 0);
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
        const r = Math.max(0, cmd.r ?? 0);
        ctx.fillStyle = cmd.color ?? "#808080";
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "arc": {
        const cx = cmd.x ?? 0;
        const cy = cmd.y ?? 0;
        const r = Math.max(0, cmd.r ?? 0);
        ctx.strokeStyle = cmd.color ?? "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(
          cx,
          cy,
          r,
          degToRad(cmd.startAngle ?? 0),
          degToRad(cmd.endAngle ?? 360),
        );
        ctx.stroke();
        break;
      }
      case "annulus": {
        const cx = cmd.x ?? 0;
        const cy = cmd.y ?? 0;
        const rOut = Math.max(0, cmd.rOut ?? 0);
        const rIn = Math.max(0, Math.min(rOut, cmd.rIn ?? 0));
        const midR = (rOut + rIn) / 2;
        const width = Math.max(1, rOut - rIn);
        ctx.strokeStyle = cmd.color ?? "#00ffff";
        ctx.lineWidth = width;
        ctx.lineCap = "butt";
        ctx.beginPath();
        ctx.arc(
          cx,
          cy,
          midR,
          degToRad(cmd.startAngle ?? 0),
          degToRad(cmd.endAngle ?? 360),
        );
        ctx.stroke();
        break;
      }
    }
  }

  ctx.restore();
}

/** Render widget Lua to a full TX15 PNG buffer. */
export function renderLuaToPng(source: string): Buffer {
  const records = parseLuaToDrawCommands(source, EDITOR_PREVIEW_SCENARIO);
  const canvas = createCanvas(LCD_W, LCD_H);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, LCD_W, LCD_H);
  renderPreviewCommands(ctx, records, 1, LCD_W, LCD_H);
  return canvas.toBuffer("image/png");
}

/**
 * Render Lua then crop to bounds (with pad), scaled down to maxWidth.
 * Used for Insert-menu prefab thumbs.
 */
export function renderLuaCroppedPng(
  source: string,
  bounds: { x: number; y: number; w: number; h: number },
  opts: { pad?: number; maxWidth?: number } = {},
): Buffer {
  const pad = opts.pad ?? 8;
  const maxWidth = opts.maxWidth ?? 160;
  const records = parseLuaToDrawCommands(source, EDITOR_PREVIEW_SCENARIO);
  const full = createCanvas(LCD_W, LCD_H);
  const fctx = full.getContext("2d");
  fctx.fillStyle = "#000000";
  fctx.fillRect(0, 0, LCD_W, LCD_H);
  renderPreviewCommands(fctx, records, 1, LCD_W, LCD_H);

  const x = Math.max(0, Math.floor(bounds.x - pad));
  const y = Math.max(0, Math.floor(bounds.y - pad));
  const w = Math.max(1, Math.min(LCD_W - x, Math.ceil(bounds.w + pad * 2)));
  const h = Math.max(1, Math.min(LCD_H - y, Math.ceil(bounds.h + pad * 2)));

  const scale = Math.min(1, maxWidth / w);
  const outW = Math.max(1, Math.round(w * scale));
  const outH = Math.max(1, Math.round(h * scale));
  const out = createCanvas(outW, outH);
  const octx = out.getContext("2d");
  octx.imageSmoothingEnabled = true;
  octx.drawImage(full, x, y, w, h, 0, 0, outW, outH);
  return out.toBuffer("image/png");
}
