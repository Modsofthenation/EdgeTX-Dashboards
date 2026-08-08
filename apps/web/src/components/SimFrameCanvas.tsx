"use client";

import { useEffect, useRef } from "react";
import type { SimFrameData } from "@widget-gen/sim-preview";
import { isChatScrolling } from "~/lib/chatScrollPause";
import { paintSimFrame, type SimFrameZone } from "~/lib/radioSim/paintSimFrame";
import styles from "./Preview480x320.module.css";

interface SimFrameCanvasProps {
  frame: SimFrameData | null;
  zone: SimFrameZone;
  className?: string;
  /** Keep paint active even while chat list is scrolling. */
  ignoreChatScrollPause?: boolean;
  /**
   * When true, scale the LCD frame up to fill the container (contain).
   * Default false keeps native pixel size as the maximum (preview side panels).
   */
  allowUpscale?: boolean;
  /** Optional test id for the LCD canvas element. */
  canvasTestId?: string;
}

export function SimFrameCanvas({
  frame,
  zone,
  className,
  ignoreChatScrollPause = false,
  allowUpscale = false,
  canvasTestId,
}: SimFrameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scratchRef = useRef<HTMLCanvasElement | null>(null);
  const lastSizeRef = useRef({ w: 0, h: 0 });
  const frameRef = useRef(frame);
  const zoneRef = useRef(zone);
  const ignorePauseRef = useRef(ignoreChatScrollPause);
  const allowUpscaleRef = useRef(allowUpscale);
  const paintRef = useRef<() => void>(() => {});

  frameRef.current = frame;
  zoneRef.current = zone;
  ignorePauseRef.current = ignoreChatScrollPause;
  allowUpscaleRef.current = allowUpscale;

  useEffect(() => {
    if (!scratchRef.current) {
      scratchRef.current = document.createElement("canvas");
    }

    const paint = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      const scratch = scratchRef.current;
      const current = frameRef.current;
      if (!canvas || !container || !scratch || !current) return;
      if (!ignorePauseRef.current && isChatScrolling()) return;

      const cw = container.clientWidth;
      const ch = container.clientHeight;
      if (cw <= 0 || ch <= 0) return;

      const z = zoneRef.current;
      const scaleX = cw / z.zoneW;
      const scaleY = ch / z.zoneH;
      const scale = Math.min(
        scaleX,
        scaleY,
        allowUpscaleRef.current ? Number.POSITIVE_INFINITY : 1,
      );
      const drawW = Math.max(1, Math.floor(z.zoneW * scale));
      const drawH = Math.max(1, Math.floor(z.zoneH * scale));

      const last = lastSizeRef.current;
      if (last.w !== drawW || last.h !== drawH) {
        canvas.width = drawW;
        canvas.height = drawH;
        lastSizeRef.current = { w: drawW, h: drawH };
      }
      canvas.style.width = `${drawW}px`;
      canvas.style.height = `${drawH}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      paintSimFrame({
        frame: current,
        zone: z,
        targetCtx: ctx,
        targetWidth: drawW,
        targetHeight: drawH,
        scratchCanvas: scratch,
      });
    };

    paintRef.current = paint;
    const observer = new ResizeObserver(paint);
    observer.observe(containerRef.current!);
    paint();

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    paintRef.current();
  }, [frame, zone, ignoreChatScrollPause, allowUpscale]);

  return (
    <div
      ref={containerRef}
      className={
        allowUpscale ? styles.simFrameContainerFill : styles.simFrameContainer
      }
    >
      <canvas
        ref={canvasRef}
        className={className ?? styles.canvas}
        aria-label="EdgeTX widget preview"
        data-testid={canvasTestId ?? "edgetx-widget-preview"}
      />
    </div>
  );
}
