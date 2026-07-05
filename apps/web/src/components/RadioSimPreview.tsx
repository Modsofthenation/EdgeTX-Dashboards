"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    if (cw <= 0 || ch <= 0) return;
    const scale = Math.min(cw / previewDims.zoneW, ch / previewDims.zoneH, 1);
    setDisplayMaxWidth(Math.max(1, Math.floor(previewDims.zoneW * scale)));
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
    <div ref={screenRef} className={styles.radioSimScreen}>
      <RadioScreen
        frameData={zoneFrame}
        width={previewDims.zoneW}
        height={previewDims.zoneH}
        depth={zoneFrame?.depth ?? 16}
        maxWidth={displayMaxWidth}
      />
    </div>
  );
}
