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
}

export function SimFrameCanvas({
  frame,
  zone,
  className,
  ignoreChatScrollPause = false,
}: SimFrameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scratchRef = useRef<HTMLCanvasElement | null>(null);
  const lastSizeRef = useRef({ w: 0, h: 0 });

  useEffect(() => {
    if (!scratchRef.current) {
      scratchRef.current = document.createElement("canvas");
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const scratch = scratchRef.current;
    if (!canvas || !container || !scratch || !frame) return;

    const paint = () => {
      if (!ignoreChatScrollPause && isChatScrolling()) return;

      const cw = container.clientWidth;
      const ch = container.clientHeight;
      if (cw <= 0 || ch <= 0) return;

      const scaleX = cw / zone.zoneW;
      const scaleY = ch / zone.zoneH;
      const scale = Math.min(scaleX, scaleY, 1);
      const drawW = Math.floor(zone.zoneW * scale);
      const drawH = Math.floor(zone.zoneH * scale);

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
        frame,
        zone,
        targetCtx: ctx,
        targetWidth: drawW,
        targetHeight: drawH,
        scratchCanvas: scratch,
      });
    };

    const observer = new ResizeObserver(paint);
    observer.observe(container);
    paint();

    return () => observer.disconnect();
  }, [frame, zone, ignoreChatScrollPause]);

  return (
    <div ref={containerRef} className={styles.simFrameContainer}>
      <canvas
        ref={canvasRef}
        className={className ?? styles.canvas}
        aria-label="EdgeTX widget preview"
      />
    </div>
  );
}
