"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { resolvePreviewDimensions } from "@widget-gen/shared";
import { BASE_MOCK, tickMock } from "@/lib/mockTelemetry";
import { parseLuaToDrawCommands, renderPreviewCommands } from "@/lib/luaPreviewEngine";
import styles from "./Preview480x320.module.css";

const LCD_W = 480;
const LCD_H = 320;

interface Preview480x320Props {
  luaSource: string | null;
  widgetName: string | null;
  live?: boolean;
  variant?: "default" | "compact";
}

export function Preview480x320({
  luaSource,
  widgetName,
  live = true,
  variant = "default",
}: Preview480x320Props) {
  const [tab, setTab] = useState<"preview" | "source">("preview");
  const [tick, setTick] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const mock = useMemo(() => (live ? tickMock(BASE_MOCK, tick) : BASE_MOCK), [live, tick]);

  const previewDims = useMemo(
    () => (luaSource ? resolvePreviewDimensions(luaSource) : null),
    [luaSource]
  );

  const commands = useMemo(() => {
    if (!luaSource) return [];
    try {
      return parseLuaToDrawCommands(luaSource, mock);
    } catch {
      return [];
    }
  }, [luaSource, mock]);

  useEffect(() => {
    if (!live || !luaSource) return;
    const id = setInterval(() => setTick((t) => t + 1), 1500);
    return () => clearInterval(id);
  }, [live, luaSource]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || tab !== "preview") return;

    const scale = container.clientWidth / LCD_W;
    canvas.width = LCD_W * scale;
    canvas.height = LCD_H * scale;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    renderPreviewCommands(ctx, commands, scale, LCD_W, LCD_H);
  }, [commands, tab]);

  const showZoneOverlay =
    previewDims &&
    (previewDims.zoneW < LCD_W ||
      previewDims.zoneH < LCD_H ||
      previewDims.zoneX > 0 ||
      previewDims.zoneY > 0);

  return (
    <div className={variant === "compact" ? styles.panelCompact : styles.panel}>
      {variant === "default" && (
        <div className={styles.header}>
          <h2 className={styles.title}>{widgetName ?? "TX15 Preview"}</h2>
          <div className={styles.tabs} role="tablist">
            <button
              role="tab"
              aria-selected={tab === "preview"}
              className={tab === "preview" ? styles.tabActive : styles.tab}
              onClick={() => setTab("preview")}
            >
              Preview
            </button>
            <button
              role="tab"
              aria-selected={tab === "source"}
              className={tab === "source" ? styles.tabActive : styles.tab}
              onClick={() => setTab("source")}
            >
              Source
            </button>
          </div>
        </div>
      )}

      {variant === "compact" && (
        <div className={styles.compactTabs} role="tablist">
          <button
            role="tab"
            aria-selected={tab === "preview"}
            className={tab === "preview" ? styles.tabActive : styles.tab}
            onClick={() => setTab("preview")}
          >
            Preview
          </button>
          <button
            role="tab"
            aria-selected={tab === "source"}
            className={tab === "source" ? styles.tabActive : styles.tab}
            onClick={() => setTab("source")}
          >
            Lua
          </button>
        </div>
      )}

      {tab === "preview" ? (
        <div className={variant === "compact" ? styles.frameWrapCompact : styles.frameWrap}>
          <div className={styles.frame}>
            <div className={variant === "compact" ? styles.deviceCompact : styles.device}>
              {variant === "default" && <div className={styles.deviceLabel}>RadioMaster TX15</div>}
              <div className={styles.screen} ref={containerRef}>
                {!luaSource ? (
                  <div className={styles.placeholder}>
                    <span className={styles.placeholderIcon} aria-hidden>
                      ◫
                    </span>
                    <span>Generate a widget to preview on the TX15 display</span>
                  </div>
                ) : (
                  <>
                    <canvas ref={canvasRef} className={styles.canvas} aria-label="Widget preview" />
                    {showZoneOverlay && previewDims && (
                      <div
                        className={styles.region}
                        style={{
                          left: `${(previewDims.zoneX / LCD_W) * 100}%`,
                          top: `${(previewDims.zoneY / LCD_H) * 100}%`,
                          width: `${(previewDims.zoneW / LCD_W) * 100}%`,
                          height: `${(previewDims.zoneH / LCD_H) * 100}%`,
                        }}
                        aria-hidden
                      >
                        <span>
                          {previewDims.layout} z{previewDims.zone}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className={styles.footer}>
              <span className={styles.meta}>480 × 320</span>
              {previewDims && (
                <span className={styles.meta}>
                  {previewDims.layout} · zone {previewDims.zone}
                </span>
              )}
              {luaSource && live && <span className={styles.liveBadge}>Live mock data</span>}
            </div>
            {luaSource && commands.length === 0 && (
              <p className={styles.hint}>
                Could not parse draw commands. Preview works best with direct lcd.drawText and
                lcd.drawFilledRectangle calls in refresh().
              </p>
            )}
          </div>
        </div>
      ) : (
        <pre className={variant === "compact" ? styles.sourceCompact : styles.source}>
          {luaSource ?? "// Lua source will appear here after generation"}
        </pre>
      )}
    </div>
  );
}
