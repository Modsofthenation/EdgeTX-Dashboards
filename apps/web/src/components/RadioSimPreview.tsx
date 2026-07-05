"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { resolvePreviewDimensions, getSimulateLayoutProfile } from "@widget-gen/shared";
import { cropZoneFromFramebuffer } from "@widget-gen/sim-preview";
import type { MockTelemetryValues } from "@widget-gen/sim-preview";
import { useRadioSim } from "@/lib/radioSim/useRadioSim";
import styles from "./Preview480x320.module.css";

const RadioScreen = dynamic(
  () => import("@edgetx/simulator-ui").then((m) => m.RadioScreen),
  { ssr: false }
);

type SimFrame = {
  buffer: ArrayBuffer;
  width: number;
  height: number;
  depth: number;
} | null;

function fitMaxWidth(
  containerW: number,
  containerH: number,
  lcdW: number,
  lcdH: number,
  capAtNative: boolean
): number {
  if (containerW <= 0 || containerH <= 0) return lcdW;
  const scale = Math.min(containerW / lcdW, containerH / lcdH, capAtNative ? 1 : Infinity);
  return Math.max(1, Math.floor(lcdW * scale));
}

function SimDisplay({
  zoneFrame,
  zoneW,
  zoneH,
  maxWidth,
}: {
  zoneFrame: SimFrame;
  zoneW: number;
  zoneH: number;
  maxWidth: number;
}) {
  return (
    <RadioScreen
      frameData={zoneFrame}
      width={zoneW}
      height={zoneH}
      depth={zoneFrame?.depth ?? 16}
      maxWidth={maxWidth}
    />
  );
}

interface RadioSimPreviewProps {
  luaSource: string;
  layoutProfileId?: string;
  mock: MockTelemetryValues;
  active: boolean;
}

export function RadioSimPreview({
  luaSource,
  layoutProfileId = "tx15",
  mock,
  active,
}: RadioSimPreviewProps) {
  const { state, frame, wasmSizeMb, init, loadWidget, setMock, dispose } = useRadioSim();
  const startedRef = useRef(false);
  const loadedSourceRef = useRef<string | null>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const fullscreenScreenRef = useRef<HTMLDivElement>(null);

  const layoutProfile = useMemo(() => {
    try {
      return getSimulateLayoutProfile(layoutProfileId);
    } catch {
      return getSimulateLayoutProfile("tx15");
    }
  }, [layoutProfileId]);

  const previewDims = useMemo(
    () => resolvePreviewDimensions(luaSource, layoutProfile),
    [luaSource, layoutProfile]
  );

  const [displayMaxWidth, setDisplayMaxWidth] = useState(previewDims.zoneW);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenMaxWidth, setFullscreenMaxWidth] = useState(previewDims.zoneW);

  const zoneFrame = useMemo(() => {
    if (!frame) return null;
    const data = new Uint8Array(frame.buffer);
    const cropped = cropZoneFromFramebuffer(
      data,
      frame.width,
      frame.height,
      frame.depth,
      previewDims.zoneX,
      previewDims.zoneY,
      previewDims.zoneW,
      previewDims.zoneH
    );
    const copy = new Uint8Array(cropped);
    return {
      buffer: copy.buffer,
      width: previewDims.zoneW,
      height: previewDims.zoneH,
      depth: frame.depth,
    };
  }, [frame, previewDims]);

  const updateDisplaySize = useCallback(() => {
    const el = screenRef.current;
    if (!el) return;
    setDisplayMaxWidth(
      fitMaxWidth(el.clientWidth, el.clientHeight, previewDims.zoneW, previewDims.zoneH, true)
    );
  }, [previewDims.zoneW, previewDims.zoneH]);

  const updateFullscreenSize = useCallback(() => {
    const el = fullscreenScreenRef.current;
    if (!el) return;
    setFullscreenMaxWidth(
      fitMaxWidth(el.clientWidth, el.clientHeight, previewDims.zoneW, previewDims.zoneH, false)
    );
  }, [previewDims.zoneW, previewDims.zoneH]);

  useEffect(() => {
    setDisplayMaxWidth(previewDims.zoneW);
  }, [previewDims.zoneW, previewDims.zoneH]);

  useEffect(() => {
    if (state.phase !== "running") return;
    const el = screenRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateDisplaySize);
    ro.observe(el);
    updateDisplaySize();
    return () => ro.disconnect();
  }, [state.phase, updateDisplaySize]);

  useEffect(() => {
    if (!fullscreen) return;
    const el = fullscreenScreenRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateFullscreenSize);
    ro.observe(el);
    updateFullscreenSize();
    return () => ro.disconnect();
  }, [fullscreen, updateFullscreenSize]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  useEffect(() => {
    if (!active) setFullscreen(false);
  }, [active]);

  useEffect(() => {
    if (!active) {
      dispose();
      startedRef.current = false;
      loadedSourceRef.current = null;
      return;
    }
    if (!startedRef.current) {
      startedRef.current = true;
      loadedSourceRef.current = luaSource;
      init({
        source: luaSource,
        zone: { layout: previewDims.layout, zone: previewDims.zone },
      });
    }
    return () => {
      dispose();
      startedRef.current = false;
      loadedSourceRef.current = null;
    };
  }, [active, init, dispose]);

  useEffect(() => {
    if (!active || state.phase !== "running") return;
    setMock(mock);
  }, [active, state.phase, mock, setMock]);

  useEffect(() => {
    if (!active || state.phase !== "running") return;
    if (loadedSourceRef.current === luaSource) return;
    loadedSourceRef.current = luaSource;
    loadWidget(luaSource, {
      layout: previewDims.layout,
      zone: previewDims.zone,
    });
  }, [active, state.phase, luaSource, loadWidget, previewDims.layout, previewDims.zone]);

  if (state.phase === "error") {
    return (
      <div className={styles.radioSimMessage}>
        <p>Radio sim unavailable: {state.error}</p>
        <p className={styles.hint}>
          Run <code>npm run setup:sim</code>, restart the dev server, and hard-refresh. Or use{" "}
          <a href="https://github.com/JeffreyChix/edgetx-dev-kit" target="_blank" rel="noreferrer">
            EdgeTX Dev Kit
          </a>{" "}
          in VS Code.
        </p>
      </div>
    );
  }

  if (state.phase === "idle" || state.phase === "loading-wasm" || state.phase === "booting") {
    return (
      <div className={styles.radioSimMessage}>
        <p>{state.status || "Loading Radio sim…"}</p>
        {wasmSizeMb != null && (
          <p className={styles.hint}>
            First load downloads ~{wasmSizeMb} MB of EdgeTX firmware (cached by the browser).
          </p>
        )}
        {state.progress > 0 && (
          <div className={styles.radioSimProgress} aria-hidden>
            <div className={styles.radioSimProgressBar} style={{ width: `${state.progress}%` }} />
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div ref={screenRef} className={styles.radioSimScreen}>
        <SimDisplay
          zoneFrame={zoneFrame}
          zoneW={previewDims.zoneW}
          zoneH={previewDims.zoneH}
          maxWidth={displayMaxWidth}
        />
        <button
          type="button"
          className={styles.radioSimExpand}
          onClick={() => setFullscreen(true)}
          aria-label="Open Radio sim fullscreen"
          title="Fullscreen"
        >
          ⛶
        </button>
      </div>
      {fullscreen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className={styles.radioSimFullscreen}
            role="dialog"
            aria-modal="true"
            aria-label="Radio sim fullscreen"
          >
            <div className={styles.radioSimFullscreenBar}>
              <span className={styles.radioSimFullscreenMeta}>
                {previewDims.zoneW} × {previewDims.zoneH} · EdgeTX WASM
              </span>
              <button
                type="button"
                className={styles.radioSimFullscreenClose}
                onClick={() => setFullscreen(false)}
              >
                Close
              </button>
            </div>
            <div ref={fullscreenScreenRef} className={styles.radioSimFullscreenScreen}>
              <SimDisplay
                zoneFrame={zoneFrame}
                zoneW={previewDims.zoneW}
                zoneH={previewDims.zoneH}
                maxWidth={fullscreenMaxWidth}
              />
            </div>
            <p className={styles.radioSimFullscreenHint}>Press Esc to exit</p>
          </div>,
          document.body
        )}
    </>
  );
}
