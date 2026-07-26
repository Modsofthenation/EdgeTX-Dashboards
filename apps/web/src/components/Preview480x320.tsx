"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  EDITOR_PREVIEW_SCENARIO,
  getLastPreviewParseMeta,
  isInterpretationReliable,
  mergeLiveIntoMock,
  parseLuaToDrawCommands,
  tickMock,
  type MockTelemetry,
} from "@widget-gen/layout-verify";
import {
  resolvePreviewDimensions,
  getSimulateLayoutProfile,
  hasColorWasmSim,
} from "@widget-gen/shared";
import { isChatScrolling } from "~/lib/chatScrollPause";
import { RadioSimPreview } from "~/components/RadioSimPreview";
import { renderPreviewCommands } from "~/lib/luaPreviewEngine";
import styles from "./Preview480x320.module.css";

interface Preview480x320Props {
  luaSource: string | null;
  widgetName: string | null;
  layoutProfileId?: string;
  /** knowledge/radios id — enables WASM when a color firmware is mapped. */
  radioId?: string;
  edgeTxVersion?: string;
  radioName?: string | null;
  live?: boolean;
  variant?: "default" | "compact";
  /** Live radio sensor map merged into the preview mock. */
  liveSensors?: Record<string, number | string> | null;
  /** Extra toolbar actions (e.g. Live radio toggle). */
  toolbarExtra?: React.ReactNode;
}

function ParserPreviewCanvas({
  luaSource,
  zoneW,
  zoneH,
  zoneX,
  zoneY,
  mock,
}: {
  luaSource: string;
  zoneW: number;
  zoneH: number;
  zoneX: number;
  zoneY: number;
  mock: typeof EDITOR_PREVIEW_SCENARIO.mock;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  const commands = useMemo(() => {
    const records = parseLuaToDrawCommands(luaSource, {
      ...EDITOR_PREVIEW_SCENARIO,
      mock,
    });
    return records.map((r) => ({
      ...r,
      x: r.x != null ? r.x - zoneX : r.x,
      y: r.y != null ? r.y - zoneY : r.y,
      x2: r.x2 != null ? r.x2 - zoneX : r.x2,
      y2: r.y2 != null ? r.y2 - zoneY : r.y2,
    }));
  }, [luaSource, mock, zoneX, zoneY]);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cw = host.clientWidth;
    const ch = host.clientHeight;
    canvas.width = cw;
    canvas.height = ch;
    const scale = Math.min(cw / zoneW, ch / zoneH);
    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    ctx.translate((cw - zoneW * scale) / 2, (ch - zoneH * scale) / 2);
    renderPreviewCommands(ctx, commands, scale, zoneW, zoneH);
    ctx.restore();
  }, [commands, zoneW, zoneH]);

  useEffect(() => {
    paint();
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(paint);
    observer.observe(host);
    return () => observer.disconnect();
  }, [paint]);

  return (
    <div ref={hostRef} className={styles.parserCanvasHost}>
      <canvas
        ref={canvasRef}
        className={styles.parserCanvas}
        aria-label="Parser preview"
      />
    </div>
  );
}

export const Preview480x320 = memo(function Preview480x320({
  luaSource,
  widgetName,
  layoutProfileId = "tx15",
  radioId = "tx15",
  edgeTxVersion = "2.11.0",
  radioName,
  live = true,
  variant = "default",
  liveSensors = null,
  toolbarExtra,
}: Preview480x320Props) {
  const [tab, setTab] = useState<"preview" | "source">("preview");
  const [tick, setTick] = useState(0);
  const [copied, setCopied] = useState(false);
  const [interactiveControls, setInteractiveControls] = useState<{
    openInteractive: () => void;
  } | null>(null);

  const baseMock = EDITOR_PREVIEW_SCENARIO.mock;
  const mock: MockTelemetry = useMemo(() => {
    const ticking = live && !liveSensors ? tickMock(baseMock, tick) : baseMock;
    if (!liveSensors) return ticking;
    return mergeLiveIntoMock(ticking, liveSensors);
  }, [live, tick, baseMock, liveSensors]);

  const layoutProfile = useMemo(() => {
    try {
      return getSimulateLayoutProfile(layoutProfileId);
    } catch {
      return getSimulateLayoutProfile("tx15");
    }
  }, [layoutProfileId]);

  const lcdW = layoutProfile.lcdW;
  const lcdH = layoutProfile.lcdH;

  const previewDims = useMemo(
    () =>
      luaSource ? resolvePreviewDimensions(luaSource, layoutProfile) : null,
    [luaSource, layoutProfile],
  );

  const displayW = previewDims?.zoneW ?? lcdW;
  const displayH = previewDims?.zoneH ?? lcdH;
  const zoneX = previewDims?.zoneX ?? 0;
  const zoneY = previewDims?.zoneY ?? 0;

  const parseMeta = useMemo(() => {
    if (!luaSource) return null;
    const cmds = parseLuaToDrawCommands(luaSource, {
      ...EDITOR_PREVIEW_SCENARIO,
      mock,
    });
    const meta = getLastPreviewParseMeta();
    return {
      skippedTextCount: meta.skippedTextCount,
      unreliable: !isInterpretationReliable(cmds, meta.skippedTextCount),
    };
  }, [luaSource, mock]);

  useEffect(() => {
    if (!live || !luaSource) return;
    const id = setInterval(() => {
      if (isChatScrolling()) return;
      setTick((t) => t + 1);
    }, 1500);
    return () => clearInterval(id);
  }, [live, luaSource]);

  const screenStyle = {
    aspectRatio: `${displayW} / ${displayH}`,
    maxWidth: displayW,
  } as const;

  const compactFrameStyle = {
    maxWidth: displayW + 16,
  } as const;

  const simActive = !!luaSource && tab !== "source";
  const firmwareLabel = edgeTxVersion.replace(/\.0$/, "");
  const useWasmSim = hasColorWasmSim(radioId);

  const handleCopySource = async () => {
    if (!luaSource) return;
    try {
      await navigator.clipboard.writeText(luaSource);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const copyButton =
    luaSource && tab === "source" ? (
      <button
        type="button"
        className={`${styles.copyBtn} ${copied ? styles.copyBtnCopied : ""}`}
        onClick={() => void handleCopySource()}
        title={copied ? "Copied" : "Copy all Lua"}
        aria-label={copied ? "Lua source copied" : "Copy all Lua source"}
      >
        {copied ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <path
              d="M20 6 9 17l-5-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <rect
              x="9"
              y="9"
              width="11"
              height="11"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.75"
            />
            <path
              d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
              stroke="currentColor"
              strokeWidth="1.75"
            />
          </svg>
        )}
      </button>
    ) : null;

  return (
    <div className={variant === "compact" ? styles.panelCompact : styles.panel}>
      {variant === "default" && (
        <div className={styles.header}>
          <h2 className={styles.title}>{widgetName ?? "TX15 Preview"}</h2>
          <div className={styles.headerTabs}>
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
            {copyButton}
            {toolbarExtra}
          </div>
        </div>
      )}

      {variant === "compact" && (
        <div className={styles.compactTabRow}>
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
          {copyButton}
          {toolbarExtra}
        </div>
      )}

      <div
        className={
          variant === "compact" ? styles.frameWrapCompact : styles.frameWrap
        }
        style={{ display: tab === "source" ? "none" : undefined }}
        aria-hidden={tab === "source"}
      >
        <div
          className={variant === "compact" ? styles.frameCompact : styles.frame}
          style={variant === "compact" ? compactFrameStyle : undefined}
        >
          <div
            className={
              variant === "compact" ? styles.deviceCompact : styles.device
            }
          >
            {variant === "default" && (
              <div className={styles.deviceLabel}>
                {radioName ?? "EdgeTX Radio"}
              </div>
            )}
            <div
              className={
                variant === "compact" ? styles.screenCompact : styles.screen
              }
              style={screenStyle}
            >
              {!luaSource ? (
                <div className={styles.placeholder}>
                  <span className={styles.placeholderIcon} aria-hidden>
                    ◫
                  </span>
                  <span>Generate a widget to preview on the radio display</span>
                </div>
              ) : useWasmSim ? (
                <RadioSimPreview
                  luaSource={luaSource}
                  layoutProfileId={layoutProfileId}
                  radioId={radioId}
                  edgeTxVersion={edgeTxVersion}
                  mock={mock}
                  live={live}
                  active={simActive}
                  onInteractiveControls={setInteractiveControls}
                />
              ) : (
                <ParserPreviewCanvas
                  luaSource={luaSource}
                  zoneW={displayW}
                  zoneH={displayH}
                  zoneX={zoneX}
                  zoneY={zoneY}
                  mock={mock}
                />
              )}
            </div>
          </div>
          <div className={styles.footer}>
            <span className={styles.meta}>
              {displayW} × {displayH}
            </span>
            {previewDims && (
              <span className={styles.meta}>
                {previewDims.layout} · zone {previewDims.zone}
              </span>
            )}
            {luaSource && useWasmSim && (
              <span className={styles.liveBadge}>
                EdgeTX {firmwareLabel} WASM
                {liveSensors
                  ? " · Live CRSF"
                  : live
                    ? " · mock telemetry"
                    : ""}
              </span>
            )}
            {luaSource && !useWasmSim && (
              <span className={styles.parserOnlyBadge}>
                Parser preview only
              </span>
            )}
          </div>
          {parseMeta &&
            (parseMeta.skippedTextCount > 0 || parseMeta.unreliable) && (
              <p className={styles.parseWarn} role="status">
                Canvas/parser may skip {parseMeta.skippedTextCount || "some"}{" "}
                draw(s) — verify in WASM sim when available for this radio.
              </p>
            )}
          {interactiveControls && useWasmSim && (
            <div className={styles.simActionsRow}>
              <button
                type="button"
                className={styles.radioSimInlineOpen}
                onClick={interactiveControls.openInteractive}
              >
                Open interactive sim
              </button>
            </div>
          )}
          {luaSource && (
            <p className={styles.hintMuted}>
              {useWasmSim
                ? `EdgeTX ${firmwareLabel} WASM preview — same output as on the radio. First load may take several seconds. Use interactive sim for touch, keys, and sticks (Esc to close).`
                : `${radioName ?? "This radio"} uses a dimension-correct parser canvas (${displayW}×${displayH}). Color WASM sim is available for TX15, TX16S, T16, T18, X10, and X12S.`}
            </p>
          )}
        </div>
      </div>

      {tab === "source" && (
        <pre
          className={
            variant === "compact" ? styles.sourceCompact : styles.source
          }
        >
          {luaSource ?? "// Lua source will appear here after generation"}
        </pre>
      )}
    </div>
  );
});
