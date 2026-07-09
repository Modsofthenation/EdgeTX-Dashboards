"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { getPreviewScenario, type LayoutScenario } from "@widget-gen/layout-verify";
import { recordsForDisplay } from "@widget-gen/editor-core";
import type { ZoneOffset } from "@widget-gen/editor-core";
import { parseLuaToDrawCommands, renderPreviewCommands } from "@/lib/luaPreviewEngine";
import type { CanvasLayout } from "../lib/canvasLayout";
import styles from "../editor.module.css";

interface EditorPreviewCanvasProps {
  source: string;
  zone: ZoneOffset;
  layout: CanvasLayout | null;
  scenarioId?: string;
}

export function EditorPreviewCanvas({
  source,
  zone,
  layout,
  scenarioId = "editor-preview",
}: EditorPreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  const scenario: LayoutScenario = useMemo(() => getPreviewScenario(scenarioId), [scenarioId]);

  const commands = useMemo(
    () => recordsForDisplay(parseLuaToDrawCommands(source, scenario), zone),
    [source, zone, scenario]
  );

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host || !layout) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cw = host.clientWidth;
    const ch = host.clientHeight;
    canvas.width = cw;
    canvas.height = ch;

    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    ctx.translate(layout.offsetX, layout.offsetY);
    renderPreviewCommands(ctx, commands, layout.scale, zone.zoneW, zone.zoneH);
    ctx.restore();
  }, [commands, layout, zone.zoneH, zone.zoneW]);

  useEffect(() => {
    paint();
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(paint);
    observer.observe(host);
    return () => observer.disconnect();
  }, [paint]);

  return (
    <div ref={hostRef} className={styles.previewHost}>
      <canvas ref={canvasRef} className={styles.previewCanvas} aria-label="Dashboard preview" />
    </div>
  );
}

export type { ZoneOffset };
