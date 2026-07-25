"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { resolvePreviewDimensions, getSimulateLayoutProfile, isFullLcdSimulateZone } from "@widget-gen/shared";
import type { MockTelemetryValues, SimFrameData, SimKeyboardMode } from "@widget-gen/sim-preview";
import type { RadioProfile } from "@edgetx/simulator-ui";
import { useRadioSim } from "~/lib/radioSim/useRadioSim";
import { SimFrameCanvas } from "~/components/SimFrameCanvas";
import styles from "./Preview480x320.module.css";

const SimulatorThemeProvider = dynamic(
  () => import("@edgetx/simulator-ui").then((m) => m.SimulatorThemeProvider),
  { ssr: false }
);

const Simulator = dynamic(
  () => import("@edgetx/simulator-ui").then((m) => m.Simulator),
  { ssr: false }
);

interface RadioSimPreviewProps {
  luaSource: string;
  layoutProfileId?: string;
  edgeTxVersion?: string;
  mock: MockTelemetryValues;
  live?: boolean;
  /** Keep WASM worker alive (pause when false). */
  active: boolean;
  /** Called when interactive sim can be opened (running) or unavailable. */
  onInteractiveControls?: (controls: { openInteractive: () => void } | null) => void;
}

function SimInteractiveOverlay({
  radioProfile,
  previewDims,
  frame,
  live,
  running,
  simState,
  keyboardMode,
  firmwareLabel,
  firmwareNote,
  showFullscreenButton,
  onEnterFullscreen,
  onClose,
  onInput,
}: {
  radioProfile: RadioProfile;
  previewDims: ReturnType<typeof resolvePreviewDimensions>;
  frame: SimFrameData | null;
  live: boolean;
  running: boolean;
  simState: { loading: boolean; error: string | null; progress: number; status: string };
  keyboardMode: SimKeyboardMode;
  firmwareLabel: string;
  firmwareNote?: string | null;
  showFullscreenButton: boolean;
  onEnterFullscreen: () => void;
  onClose: () => void;
  onInput: (msg: object) => void;
}) {
  const frameData = useMemo(() => {
    if (!frame) return null;
    return {
      buffer: frame.buffer,
      width: frame.width,
      height: frame.height,
      depth: frame.depth,
    };
  }, [frame]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={styles.radioSimInteractive}
      role="dialog"
      aria-modal="true"
      aria-label="EdgeTX interactive simulator"
    >
      <div className={styles.radioSimInteractiveBar}>
        <span className={styles.radioSimFullscreenMeta}>
          {previewDims.lcdW} × {previewDims.lcdH} · EdgeTX {firmwareLabel} WASM · {previewDims.layout} z
          {previewDims.zone}
          {firmwareNote ? <span className={styles.radioSimLiveTag}> · {firmwareNote}</span> : null}
          {live && running && <span className={styles.radioSimLiveTag}> · Live mock telemetry</span>}
        </span>
        {showFullscreenButton && (
          <button
            type="button"
            className={styles.radioSimInlineOpen}
            onClick={onEnterFullscreen}
          >
            Enter widget fullscreen
          </button>
        )}
        <button type="button" className={styles.radioSimFullscreenClose} onClick={onClose}>
          Close
        </button>
      </div>
      <div className={styles.radioSimInteractiveBody}>
        <div className={styles.radioSimInteractiveStage}>
          <SimulatorThemeProvider theme="dark">
            <Simulator
              radio={radioProfile}
              frameData={frameData}
              simState={simState}
              keyboardMode={keyboardMode}
              onInput={onInput}
            />
          </SimulatorThemeProvider>
        </div>
      </div>
      <p className={styles.radioSimFullscreenHint}>
        Double-tap widget for fullscreen · Esc to close · Arrow keys = rotary encoder
      </p>
    </div>,
    document.body
  );
}

export function RadioSimPreview({
  luaSource,
  layoutProfileId = "tx15",
  edgeTxVersion = "2.11.0",
  mock,
  live = true,
  active,
  onInteractiveControls,
}: RadioSimPreviewProps) {
  const {
    state,
    firmware,
    wasmSizeMb,
    keyboardMode,
    init,
    loadWidget,
    setMock,
    sendInput,
    pause,
    resume,
    enterWidgetFullscreen,
    subscribeFrames,
    dispose,
  } = useRadioSim();
  const startedRef = useRef(false);
  const desiredSourceRef = useRef(luaSource);
  const mockRef = useRef(mock);
  const appliedSourceRef = useRef<string | null>(null);
  const loadedFirmwareRef = useRef<string | null>(null);
  const sendInputRef = useRef(sendInput);
  const [frame, setFrame] = useState<SimFrameData | null>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [radioProfile, setRadioProfile] = useState<RadioProfile | null>(null);

  sendInputRef.current = sendInput;

  const stableSendInput = useCallback((msg: object) => {
    sendInputRef.current(msg as Parameters<typeof sendInput>[0]);
  }, []);

  useEffect(() => {
    import("@edgetx/simulator-ui")
      .then((m) => {
        const radios = m.radios as RadioProfile[];
        const tx15 = radios.find((r) => r.wasm === "edgetx-tx15-simulator.wasm");
        if (tx15) setRadioProfile(tx15);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    subscribeFrames((next) => setFrame(next));
    return () => subscribeFrames(null);
  }, [subscribeFrames]);

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

  const simZone = useMemo(
    () => ({
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
    }),
    [previewDims]
  );

  const frameZone = useMemo(
    () => ({
      zoneX: previewDims.zoneX,
      zoneY: previewDims.zoneY,
      zoneW: previewDims.zoneW,
      zoneH: previewDims.zoneH,
    }),
    [previewDims]
  );
  mockRef.current = mock;

  const openInteractive = useCallback(() => setOverlayOpen(true), []);

  useEffect(() => {
    if (!onInteractiveControls) return;
    if (active && state.phase === "running") {
      onInteractiveControls({ openInteractive });
    } else {
      onInteractiveControls(null);
    }
    return () => onInteractiveControls(null);
  }, [active, state.phase, openInteractive, onInteractiveControls]);

  useEffect(() => {
    if (!active) setOverlayOpen(false);
  }, [active]);

  const simState = useMemo(
    () => ({
      loading: state.phase === "loading-wasm" || state.phase === "booting",
      error: state.error,
      progress: state.progress,
      status: state.status,
    }),
    [state]
  );

  const firmwareLabel = firmware?.label ?? edgeTxVersion.replace(/\.0$/, "");
  const firmwareNote = useMemo(() => {
    if (!firmware) return null;
    if (firmware.aliasOf) return `uses ${firmware.aliasOf.replace(/\.0$/, "")} firmware`;
    if (firmware.fallback) return "nearest available firmware";
    return null;
  }, [firmware]);

  useEffect(() => {
    if (!active) {
      pause();
      return;
    }

    resume();

    const firmwareChanged = loadedFirmwareRef.current !== edgeTxVersion;
    if (startedRef.current && !firmwareChanged) return;

    if (startedRef.current && firmwareChanged) {
      dispose();
      appliedSourceRef.current = null;
    }

    startedRef.current = true;
    loadedFirmwareRef.current = edgeTxVersion;
    desiredSourceRef.current = desiredSourceRef.current || luaSource;
    // Reconcile once after running; don't trust init source application as final.
    appliedSourceRef.current = null;
    void init({
      source: desiredSourceRef.current,
      zone: simZone,
      mock: mockRef.current,
      edgeTxVersion,
    });
  }, [active, edgeTxVersion, simZone, init, pause, resume, dispose]);

  useEffect(() => {
    return () => {
      dispose();
      startedRef.current = false;
      desiredSourceRef.current = "";
      appliedSourceRef.current = null;
      loadedFirmwareRef.current = null;
    };
  }, [dispose]);

  useEffect(() => {
    if (!active || state.phase !== "running") return;
    setMock(mock);
  }, [active, state.phase, mock, setMock]);

  useEffect(() => {
    if (!active || state.phase !== "running") return;
    desiredSourceRef.current = luaSource;
    if (appliedSourceRef.current === desiredSourceRef.current) return;
    void loadWidget(desiredSourceRef.current, simZone)
      .then(() => {
        appliedSourceRef.current = desiredSourceRef.current;
      })
      .catch(() => {
        // keep desired source; next running/source transition retries.
      });
  }, [active, state.phase, luaSource, loadWidget, simZone]);

  if (state.phase === "error") {
    return (
      <div className={styles.simPreviewRoot}>
        <div className={styles.radioSimMessage}>
          <p>Radio preview unavailable: {state.error}</p>
          <p className={styles.hint}>
            The EdgeTX firmware may still be downloading, or the sim worker crashed. Hard-refresh the
            page. If this persists, run <code>npm run setup:sim</code> then restart the app.
          </p>
        </div>
      </div>
    );
  }

  if (state.phase === "idle" || state.phase === "loading-wasm" || state.phase === "booting") {
    return (
      <div className={styles.simPreviewRoot}>
        <div className={styles.radioSimMessage}>
          <div className={styles.radioSimBrand} aria-hidden>
            ETX
          </div>
          <p>{state.status || "Booting EdgeTX radio preview…"}</p>
          {wasmSizeMb != null && (
            <p className={styles.hint}>
              First load downloads ~{wasmSizeMb} MB of firmware (cached afterward).
            </p>
          )}
          {state.progress > 0 && (
            <div className={styles.radioSimProgress} aria-hidden>
              <div className={styles.radioSimProgressBar} style={{ width: `${state.progress}%` }} />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.simPreviewRoot}>
      <SimFrameCanvas frame={frame} zone={frameZone} />

      {overlayOpen && radioProfile && (
        <SimInteractiveOverlay
          radioProfile={radioProfile}
          previewDims={previewDims}
          frame={frame}
          live={live}
          running={state.phase === "running"}
          simState={simState}
          keyboardMode={keyboardMode}
          firmwareLabel={firmwareLabel}
          firmwareNote={firmwareNote}
          showFullscreenButton={simZone.enterFullscreen === true}
          onEnterFullscreen={enterWidgetFullscreen}
          onClose={() => setOverlayOpen(false)}
          onInput={stableSendInput}
        />
      )}
    </div>
  );
}
