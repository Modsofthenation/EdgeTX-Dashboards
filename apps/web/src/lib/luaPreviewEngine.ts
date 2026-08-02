import type { PreviewDrawCommand } from "@widget-gen/layout-verify";
import { edgeTxTextSize } from "@widget-gen/layout-verify";

export {
  parseLuaToDrawCommands,
  parseLuaToDrawCommandsStatic,
  applyMockToCommands,
  getLastPreviewParseMeta,
  interpretWidgetLayout,
  COLOR_MAP,
  THEME_COLOR_MAP,
  type PreviewDrawCommand,
  type PreviewParseMeta,
  type PreviewStaticParse,
  type EdgeColor,
} from "@widget-gen/layout-verify";

export { edgeTxTextSize };

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * EdgeTX arc angles: 0° = up, increasing clockwise.
 * Canvas2D: 0° = east (positive x), clockwise with y-down.
 */
export function edgeTxDegToCanvasRad(deg: number): number {
  return degToRad(deg - 90);
}

/**
 * Preview text metrics for the approximate (non-WASM) canvas painter.
 * Prefer live measureText when a 2D context is available; otherwise fall back
 * to the EdgeTX color-LCD advance table (see fontMetrics.ts).
 *
 * Editor selection outlines use `edgeTxTextSize` directly so they track WASM
 * glyphs rather than browser monospace.
 */
export function measurePreviewText(
  text: string,
  fontSize: number,
  ctx?: CanvasRenderingContext2D | null,
): { w: number; h: number } {
  if (ctx) {
    ctx.font = `bold ${fontSize}px monospace`;
    const measured = ctx.measureText(text).width;
    return { w: Math.max(1, measured), h: fontSize };
  }
  return edgeTxTextSize(text, fontSize);
}

/** Draw text with EdgeTX top-left origin; width matches measurePreviewText. */
function fillPreviewText(
  ctx: CanvasRenderingContext2D,
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
  ctx: CanvasRenderingContext2D,
  commands: PreviewDrawCommand[],
  scale: number,
  lcdW = 480,
  lcdH = 320,
): void {
  ctx.save();
  ctx.scale(scale, scale);

  for (const cmd of commands) {
    switch (cmd.kind) {
      case "clear":
        ctx.fillStyle = cmd.color ?? "#000000";
        ctx.fillRect(0, 0, lcdW, lcdH);
        break;
      case "filledRect": {
        ctx.fillStyle = cmd.color ?? "#808080";
        const prevAlpha = ctx.globalAlpha;
        if (cmd.opacity != null) {
          ctx.globalAlpha =
            prevAlpha * Math.max(0, Math.min(1, cmd.opacity / 15));
        }
        ctx.fillRect(cmd.x ?? 0, cmd.y ?? 0, cmd.w ?? 0, cmd.h ?? 0);
        ctx.globalAlpha = prevAlpha;
        break;
      }
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
          edgeTxDegToCanvasRad(cmd.startAngle ?? 0),
          edgeTxDegToCanvasRad(cmd.endAngle ?? 360),
        );
        ctx.stroke();
        break;
      }
      case "annulus": {
        const cx = cmd.x ?? 0;
        const cy = cmd.y ?? 0;
        const rOut = Math.max(0, cmd.rOut ?? 0);
        const rIn = Math.max(0, Math.min(rOut, cmd.rIn ?? 0));
        const start = edgeTxDegToCanvasRad(cmd.startAngle ?? 0);
        const end = edgeTxDegToCanvasRad(cmd.endAngle ?? 360);
        ctx.fillStyle = cmd.color ?? "#00ffff";
        ctx.beginPath();
        ctx.arc(cx, cy, rOut, start, end, false);
        if (rIn > 0) {
          ctx.arc(cx, cy, rIn, end, start, true);
        }
        ctx.closePath();
        ctx.fill();
        break;
      }
    }
  }

  ctx.restore();
}
