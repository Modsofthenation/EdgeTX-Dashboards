"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { resolvePreviewDimensions, getSimulateLayoutProfile } from "@widget-gen/shared";
import { BASE_MOCK, tickMock } from "@/lib/mockTelemetry";
import { isChatScrolling } from "@/lib/chatScrollPause";
import { RadioSimPreview } from "@/components/RadioSimPreview";
import styles from "./Preview480x320.module.css";

interface Preview480x320Props {
  luaSource: string | null;
  widgetName: string | null;
  layoutProfileId?: string;
  edgeTxVersion?: string;
  radioName?: string | null;
  live?: boolean;
  variant?: "default" | "compact";
}

export const Preview480x320 = memo(function Preview480x320({
  luaSource,
  widgetName,
  layoutProfileId = "tx15",
  edgeTxVersion = "2.11.0",
  radioName,
  live = true,
  variant = "default",
}: Preview480x320Props) {
  const [tab, setTab] = useState<"preview" | "source">("preview");
  const [tick, setTick] = useState(0);
  const [interactiveControls, setInteractiveControls] = useState<{ openInteractive: () => void } | null>(
    null
  );

  const mock = useMemo(() => (live ? tickMock(BASE_MOCK, tick) : BASE_MOCK), [live, tick]);

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
    () => (luaSource ? resolvePreviewDimensions(luaSource, layoutProfile) : null),
    [luaSource, layoutProfile]
  );

  const displayW = previewDims?.zoneW ?? lcdW;
  const displayH = previewDims?.zoneH ?? lcdH;

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

      <div
        className={variant === "compact" ? styles.frameWrapCompact : styles.frameWrap}
        style={{ display: tab === "source" ? "none" : undefined }}
        aria-hidden={tab === "source"}
      >
        <div
          className={variant === "compact" ? styles.frameCompact : styles.frame}
          style={variant === "compact" ? compactFrameStyle : undefined}
        >
          <div className={variant === "compact" ? styles.deviceCompact : styles.device}>
            {variant === "default" && (
              <div className={styles.deviceLabel}>{radioName ?? "EdgeTX Radio"}</div>
            )}
            <div
              className={variant === "compact" ? styles.screenCompact : styles.screen}
              style={screenStyle}
            >
              {!luaSource ? (
                <div className={styles.placeholder}>
                  <span className={styles.placeholderIcon} aria-hidden>
                    ◫
                  </span>
                  <span>Generate a widget to preview on the TX15 display</span>
                </div>
              ) : (
                <RadioSimPreview
                  luaSource={luaSource}
                  layoutProfileId={layoutProfileId}
                  edgeTxVersion={edgeTxVersion}
                  mock={mock}
                  live={live}
                  active={simActive}
                  onInteractiveControls={setInteractiveControls}
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
            {luaSource && (
              <span className={styles.liveBadge}>
                EdgeTX {firmwareLabel} WASM{live ? " · live mock" : ""}
              </span>
            )}
          </div>
          {interactiveControls && (
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
              EdgeTX {firmwareLabel} WASM preview — same output as on the radio. First load may take
              several seconds. Use interactive sim for touch, keys, and sticks (Esc to close).
            </p>
          )}
        </div>
      </div>

      {tab === "source" && (
        <pre className={variant === "compact" ? styles.sourceCompact : styles.source}>
          {luaSource ?? "// Lua source will appear here after generation"}
        </pre>
      )}
    </div>
  );
});
