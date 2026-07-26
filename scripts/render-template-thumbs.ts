/**
 * Bake TX15 gallery template thumbnails as PNG for the Generate empty state.
 *
 * Usage: npm run render:template-thumbs
 *
 * Requires @napi-rs/canvas (root devDependency). Output:
 *   apps/web/public/templates/<gallery-id>.png
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import {
  getLayoutTemplateBoardSource,
  insertPrefabSections,
  ROTORFLIGHT_ELECTRIC_LAYOUT_ORDER,
  ROTORFLIGHT_NITRO_LAYOUT_ORDER,
} from "../packages/editor-core/src/index.ts";
import {
  EDITOR_PREVIEW_SCENARIO,
  parseLuaToDrawCommands,
  type PreviewDrawCommand,
} from "../packages/layout-verify/src/index.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "apps", "web", "public", "templates");

const LCD_W = 480;
const LCD_H = 320;

const PREFAB_SHELL = `---@type WidgetScript
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

/** Gallery id → Lua source for the board shown in Layout for that template. */
function sourceForGalleryId(id: string): string {
  switch (id) {
    case "heli-electric": {
      // Bake RF sections alone (cleaner than starter+append used at runtime).
      const { source } = insertPrefabSections(PREFAB_SHELL, [
        ...ROTORFLIGHT_ELECTRIC_LAYOUT_ORDER,
      ]);
      return source;
    }
    case "heli-nitro": {
      const { source } = insertPrefabSections(PREFAB_SHELL, [
        ...ROTORFLIGHT_NITRO_LAYOUT_ORDER,
      ]);
      return source;
    }
    case "minimal-quad":
    case "dense-crsf":
    case "whoop":
    case "freestyle-quad":
    case "battery-tool":
    case "flight-logger":
      return getLayoutTemplateBoardSource(id);
    default:
      throw new Error(`Unknown gallery template id: ${id}`);
  }
}

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

/** Same draw path as apps/web luaPreviewEngine (kept local for the Node script). */
function renderPreviewCommands(
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

function renderPng(source: string): Buffer {
  const records = parseLuaToDrawCommands(source, EDITOR_PREVIEW_SCENARIO);
  const canvas = createCanvas(LCD_W, LCD_H);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, LCD_W, LCD_H);
  renderPreviewCommands(ctx, records, 1, LCD_W, LCD_H);
  return canvas.toBuffer("image/png");
}

const GALLERY_IDS = [
  "minimal-quad",
  "heli-electric",
  "heli-nitro",
  "dense-crsf",
  "whoop",
  "freestyle-quad",
  "battery-tool",
  "flight-logger",
] as const;

mkdirSync(OUT_DIR, { recursive: true });

for (const id of GALLERY_IDS) {
  const source = sourceForGalleryId(id);
  const png = renderPng(source);
  const out = join(OUT_DIR, `${id}.png`);
  writeFileSync(out, png);
  console.log(`wrote ${out} (${png.length} bytes)`);
}
