"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  getPreviewScenario,
  type LayoutScenario,
} from "@widget-gen/layout-verify";
import {
  applyLiveDragToRecords,
  recordsForDisplay,
  type LiveDragState,
  type ZoneOffset,
} from "@widget-gen/editor-core";
import {
  parseLuaToDrawCommands,
  renderPreviewCommands,
} from "~/lib/luaPreviewEngine";
import type { CanvasLayout } from "../lib/canvasLayout";
import styles from "../editor.module.css";

interface EditorPreviewCanvasProps {
  source: string;
  zone: ZoneOffset;
  layout: CanvasLayout | null;
  scenarioId?: string;
  /** When set (e.g. live radio), overrides the named scenario. */
  scenarioOverride?: LayoutScenario;
  /** In-progress drag/resize geometry (zone space) — does not re-parse Lua. */
  liveDrag?: LiveDragState | null;
}

export function EditorPreviewCanvas({
  source,
  zone,
  layout,
  scenarioId = "editor-preview",
  scenarioOverride,
  liveDrag = null,
}: EditorPreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const scenario: LayoutScenario = useMemo(
    () => scenarioOverride ?? getPreviewScenario(scenarioId),
    [scenarioId, scenarioOverride],
  );

  /** Parse only when source/scenario change — never on live drag. */
  const baseCommands = useMemo(() => {
    const parsed = parseLuaToDrawCommands(source, scenario);
    return parsed.map((cmd) => ({
      ...cmd,
      id: cmd.sourceLine != null ? `L${cmd.sourceLine}` : undefined,
    }));
  }, [source, scenario]);

  const commands = useMemo(() => {
    const zoneCmds = recordsForDisplay(baseCommands, zone);
    return applyLiveDragToRecords(zoneCmds, liveDrag);
  }, [baseCommands, zone, liveDrag]);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layout || layout.scale <= 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Bitmap size must match the overlay frame exactly to avoid CSS stretch skew.
    const cw = Math.max(1, Math.round(layout.drawW + layout.offsetX * 2));
    const ch = Math.max(1, Math.round(layout.drawH + layout.offsetY * 2));
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }

    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    ctx.translate(layout.offsetX, layout.offsetY);
    renderPreviewCommands(ctx, commands, layout.scale, zone.zoneW, zone.zoneH);
    ctx.restore();
  }, [commands, layout, zone.zoneH, zone.zoneW]);

  useEffect(() => {
    paint();
  }, [paint]);

  if (!layout || layout.scale <= 0) {
    return <div className={styles.previewHost} aria-hidden />;
  }

  const frameW = Math.round(layout.drawW + layout.offsetX * 2);
  const frameH = Math.round(layout.drawH + layout.offsetY * 2);

  return (
    <div className={styles.previewHost}>
      <canvas
        ref={canvasRef}
        className={styles.previewCanvas}
        width={frameW}
        height={frameH}
        style={{ width: frameW, height: frameH }}
        aria-label="Dashboard preview"
        data-testid="editor-parser-preview"
        data-content-x={Math.round(layout.offsetX)}
        data-content-y={Math.round(layout.offsetY)}
        data-content-w={Math.round(layout.drawW)}
        data-content-h={Math.round(layout.drawH)}
      />
    </div>
  );
}

export type { ZoneOffset };
