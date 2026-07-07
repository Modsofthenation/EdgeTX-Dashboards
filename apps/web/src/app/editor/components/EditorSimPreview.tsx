"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getSimulateLayoutProfile,
  isFullLcdSimulateZone,
  resolvePreviewDimensions,
} from "@widget-gen/shared";
import type { MockTelemetryValues, SimFrameData } from "@widget-gen/sim-preview";
import { BASE_MOCK } from "@widget-gen/layout-verify";
import { useRadioSim } from "@/lib/radioSim/useRadioSim";
import { SimFrameCanvas } from "@/components/SimFrameCanvas";
import previewStyles from "@/components/Preview480x320.module.css";

interface EditorSimPreviewProps {
  luaSource: string;
  /** When false, defer WASM boot until remote widget source is loaded. */
  simReady?: boolean;
  /** Increment to force an immediate WASM reload (e.g. on drag end). */
  flushNonce?: number;
  mock?: MockTelemetryValues;
  edgeTxVersion?: string;
}

const RELOAD_THROTTLE_MS = 100;

/**
 * WASM preview for the dashboard editor — hot-reloads on every Lua change.
 */
export function EditorSimPreview({
  luaSource,
  simReady = true,
  flushNonce = 0,
  mock = BASE_MOCK,
  edgeTxVersion = "2.11.0",
}: EditorSimPreviewProps) {
  const { state, init, loadWidget, setMock, resume, subscribeFrames, dispose } = useRadioSim();

  const [frame, setFrame] = useState<SimFrameData | null>(null);
  const startedRef = useRef(false);
  const loadedFirmwareRef = useRef<string | null>(null);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestLuaRef = useRef(luaSource);
  const simZoneRef = useRef<ReturnType<typeof buildSimZone> | null>(null);

  latestLuaRef.current = luaSource;

  const layoutProfile = useMemo(() => getSimulateLayoutProfile("tx15"), []);

  const previewDims = useMemo(
    () => resolvePreviewDimensions(luaSource, layoutProfile),
    [luaSource, layoutProfile]
  );

  const simZone = useMemo(() => buildSimZone(previewDims), [previewDims]);
  simZoneRef.current = simZone;

  const pushLuaToSim = useCallback((source: string) => {
    loadWidget(source, simZoneRef.current ?? undefined);
  }, [loadWidget]);

  const scheduleReload = useCallback(
    (immediate = false) => {
      if (reloadTimerRef.current) {
        clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }
      if (immediate) {
        pushLuaToSim(latestLuaRef.current);
        return;
      }
      reloadTimerRef.current = setTimeout(() => {
        reloadTimerRef.current = null;
        pushLuaToSim(latestLuaRef.current);
      }, RELOAD_THROTTLE_MS);
    },
    [pushLuaToSim]
  );

  useEffect(() => {
    subscribeFrames(setFrame);
    return () => subscribeFrames(null);
  }, [subscribeFrames]);

  // Boot sim once per firmware version (after widget source is ready).
  useEffect(() => {
    if (!simReady) return;

    resume();

    const firmwareChanged = loadedFirmwareRef.current !== edgeTxVersion;
    if (startedRef.current && !firmwareChanged) return;

    if (startedRef.current && firmwareChanged) {
      dispose();
    }

    startedRef.current = true;
    loadedFirmwareRef.current = edgeTxVersion;
    void init({ source: luaSource, zone: simZone, mock, edgeTxVersion });

    return () => {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      dispose();
      startedRef.current = false;
      loadedFirmwareRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot when ready; lua hot-reload via loadWidget
  }, [simReady, edgeTxVersion, init, dispose, resume]);

  useEffect(() => {
    if (state.phase === "running") setMock(mock);
  }, [state.phase, mock, setMock]);

  // Throttled hot-reload when generated Lua changes.
  useEffect(() => {
    if (state.phase !== "running") return;
    scheduleReload();
  }, [luaSource, state.phase, scheduleReload]);

  // Immediate reload when drag/resize ends.
  useEffect(() => {
    if (state.phase !== "running" || flushNonce === 0) return;
    scheduleReload(true);
  }, [flushNonce, state.phase, scheduleReload]);

  if (!simReady || state.phase === "idle" || state.phase === "loading-wasm" || state.phase === "booting") {
    return (
      <div className={previewStyles.simPreviewRoot}>
        <div className={previewStyles.radioSimMessage}>
          <p>{!simReady ? "Loading widget…" : state.status || "Booting EdgeTX preview…"}</p>
        </div>
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className={previewStyles.simPreviewRoot}>
        <div className={previewStyles.radioSimMessage}>
          <p>EdgeTX preview unavailable: {state.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={previewStyles.simPreviewRoot}>
      <SimFrameCanvas frame={frame} zone={frameZoneFromDims(previewDims)} />
    </div>
  );
}

function buildSimZone(previewDims: ReturnType<typeof resolvePreviewDimensions>) {
  return {
    layout: previewDims.layout,
    zone: previewDims.zone,
    enterFullscreen: isFullLcdSimulateZone(previewDims),
    zoneX: previewDims.zoneX,
    zoneY: previewDims.zoneY,
    zoneW: previewDims.zoneW,
    zoneH: previewDims.zoneH,
    fullscreenTapX: isFullLcdSimulateZone(previewDims)
      ? Math.floor(previewDims.lcdW / 2)
      : Math.floor(previewDims.zoneX + previewDims.zoneW / 2),
    fullscreenTapY: isFullLcdSimulateZone(previewDims)
      ? Math.floor(previewDims.lcdH / 2)
      : Math.floor(previewDims.zoneY + previewDims.zoneH / 2),
  };
}

function frameZoneFromDims(previewDims: ReturnType<typeof resolvePreviewDimensions>) {
  return {
    zoneX: previewDims.zoneX,
    zoneY: previewDims.zoneY,
    zoneW: previewDims.zoneW,
    zoneH: previewDims.zoneH,
  };
}
