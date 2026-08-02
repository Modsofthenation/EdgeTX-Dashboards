"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import {
  resolvePreviewDimensions,
  getSimulateLayoutProfile,
  isFullLcdSimulateZone,
} from "@widget-gen/shared";
import type {
  MockTelemetryValues,
  SimFrameData,
  SimKeyboardMode,
} from "@widget-gen/sim-preview";
import type { RadioProfile } from "@edgetx/simulator-ui";
import { useRadioSim } from "~/lib/radioSim/useRadioSim";
import { getColorWasmRadio, wasmFileForFlavour } from "@widget-gen/shared";
import { SimFrameCanvas } from "~/components/SimFrameCanvas";
import styles from "./Preview480x320.module.css";

const SimulatorThemeProvider = dynamic(
  () => import("@edgetx/simulator-ui").then((m) => m.SimulatorThemeProvider),
  { ssr: false },
);

const Simulator = dynamic(
  () => import("@edgetx/simulator-ui").then((m) => m.Simulator),
  { ssr: false },
);

interface RadioSimPreviewProps {
  luaSource: string;
  layoutProfileId?: string;
  /** knowledge/radios id for WASM flavour selection. */
  radioId?: string;
  edgeTxVersion?: string;
  mock: MockTelemetryValues;
  live?: boolean;
  /** Keep WASM worker alive (pause when false). */
  active: boolean;
  /** Scale the LCD frame up to fill the host (sim modal). */
  fillHost?: boolean;
  /** Optional model PNG for virtual SD `/IMAGES/simmodel.png` (drawBitmap). */
  modelPng?: Uint8Array | null;
  /** Called when interactive sim can be opened (running) or unavailable. */
  onInteractiveControls?: (
    controls: { openInteractive: () => void } | null,
  ) => void;
  /** Fires when the WASM runtime reaches (or leaves) the running phase. */
  onRunningChange?: (running: boolean) => void;
}

declare global {
  interface Window {
    /** E2E / debug: replay widget fullscreen double-tap for inline radio preview. */
    __edgetxEnterWidgetFullscreen?: () => void;
  }
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
  simState: {
    loading: boolean;
    error: string | null;
    progress: number;
    status: string;
  };
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
          {previewDims.lcdW} × {previewDims.lcdH} · EdgeTX {firmwareLabel} WASM
          · {previewDims.layout} z{previewDims.zone}
          {firmwareNote ? (
            <span className={styles.radioSimLiveTag}> · {firmwareNote}</span>
          ) : null}
          {live && running && (
            <span className={styles.radioSimLiveTag}>
              {" "}
              · Live mock telemetry
            </span>
          )}
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
        <button
          type="button"
          className={styles.radioSimFullscreenClose}
          onClick={onClose}
        >
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
        Double-tap widget for fullscreen · Esc to close · Arrow keys = rotary
        encoder
      </p>
    </div>,
    document.body,
  );
}

export function RadioSimPreview({
  luaSource,
  layoutProfileId = "tx15",
  radioId = "tx15",
  edgeTxVersion = "2.11.0",
  mock,
  live = true,
  active,
  fillHost = false,
  modelPng = null,
  onInteractiveControls,
  onRunningChange,
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
  const modelPngRef = useRef(modelPng);
  const appliedSourceRef = useRef<string | null>(null);
  const appliedModelPngRef = useRef<Uint8Array | null | undefined>(undefined);
  const loadedFirmwareRef = useRef<string | null>(null);
  const loadedRadioRef = useRef<string | null>(null);
  const crashRetryCountRef = useRef(0);
  const hotReloadAttemptRef = useRef(0);
  const sendInputRef = useRef(sendInput);
  const [bootNonce, setBootNonce] = useState(0);
  const [autoRecovering, setAutoRecovering] = useState(false);
  const [frame, setFrame] = useState<SimFrameData | null>(null);
  /** Keep last good frame during soft-restarts so the LCD doesn't blank. */
  const lastGoodFrameRef = useRef<SimFrameData | null>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [radioProfile, setRadioProfile] = useState<RadioProfile | null>(null);

  sendInputRef.current = sendInput;

  const stableSendInput = useCallback((msg: object) => {
    sendInputRef.current(msg as Parameters<typeof sendInput>[0]);
  }, []);

  useEffect(() => {
    const target = getColorWasmRadio(radioId);
    const wasmName = target
      ? wasmFileForFlavour(target.flavour)
      : "edgetx-tx15-simulator.wasm";
    import("@edgetx/simulator-ui")
      .then((m) => {
        const radios = m.radios as RadioProfile[];
        const profile = radios.find((r) => r.wasm === wasmName);
        if (profile) setRadioProfile(profile);
      })
      .catch(() => {});
  }, [radioId]);

  useEffect(() => {
    subscribeFrames((next) => {
      lastGoodFrameRef.current = next;
      setFrame(next);
    });
    return () => subscribeFrames(null);
    // Re-bind after auto-recover / firmware reboot (bootNonce) in case dispose
    // historically cleared the subscriber while this component stayed mounted.
  }, [subscribeFrames, bootNonce]);

  const layoutProfile = useMemo(() => {
    try {
      return getSimulateLayoutProfile(layoutProfileId);
    } catch {
      return getSimulateLayoutProfile("tx15");
    }
  }, [layoutProfileId]);

  const previewDims = useMemo(
    () => resolvePreviewDimensions(luaSource, layoutProfile),
    [luaSource, layoutProfile],
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
    [previewDims],
  );

  const frameZone = useMemo(
    () => ({
      zoneX: previewDims.zoneX,
      zoneY: previewDims.zoneY,
      zoneW: previewDims.zoneW,
      zoneH: previewDims.zoneH,
    }),
    [previewDims],
  );
  mockRef.current = mock;
  modelPngRef.current = modelPng;

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
    onRunningChange?.(active && state.phase === "running");
    return () => onRunningChange?.(false);
  }, [active, state.phase, onRunningChange]);

  useEffect(() => {
    if (!fillHost || !active) return;
    window.__edgetxEnterWidgetFullscreen = () => {
      enterWidgetFullscreen();
    };
    return () => {
      delete window.__edgetxEnterWidgetFullscreen;
    };
  }, [fillHost, active, enterWidgetFullscreen]);

  useEffect(() => {
    if (!active) setOverlayOpen(false);
  }, [active]);

  const rebootSim = useCallback(() => {
    dispose();
    startedRef.current = false;
    appliedSourceRef.current = null;
    appliedModelPngRef.current = undefined;
    loadedFirmwareRef.current = null;
    loadedRadioRef.current = null;
    setBootNonce((n) => n + 1);
  }, [dispose]);

  useEffect(() => {
    if (state.phase === "running") {
      crashRetryCountRef.current = 0;
      setAutoRecovering(false);
    }
  }, [state.phase]);

  // Auto-recover a few times after worker aborts (common during rapid edits).
  useEffect(() => {
    if (!active || state.phase !== "error") return;
    if (crashRetryCountRef.current >= 2) {
      setAutoRecovering(false);
      return;
    }
    crashRetryCountRef.current += 1;
    setAutoRecovering(true);
    const delayMs = 350 * crashRetryCountRef.current;
    const timer = window.setTimeout(() => {
      rebootSim();
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [active, state.phase, rebootSim]);

  const simState = useMemo(
    () => ({
      loading: state.phase === "loading-wasm" || state.phase === "booting",
      error: state.error,
      progress: state.progress,
      status: state.status,
    }),
    [state],
  );

  const firmwareLabel = firmware?.label ?? edgeTxVersion.replace(/\.0$/, "");
  const firmwareNote = useMemo(() => {
    if (!firmware) return null;
    if (firmware.aliasOf)
      return `uses ${firmware.aliasOf.replace(/\.0$/, "")} firmware`;
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
    const radioChanged = loadedRadioRef.current !== radioId;
    if (startedRef.current && !firmwareChanged && !radioChanged) return;

    if (startedRef.current && (firmwareChanged || radioChanged)) {
      dispose();
      appliedSourceRef.current = null;
    }

    startedRef.current = true;
    loadedFirmwareRef.current = edgeTxVersion;
    loadedRadioRef.current = radioId;
    desiredSourceRef.current = desiredSourceRef.current || luaSource;
    // Mark the boot source as applied so the running-phase reconciler does not
    // immediately soft-restart with the same script.
    appliedSourceRef.current = desiredSourceRef.current;
    appliedModelPngRef.current = modelPngRef.current;
    void init({
      source: desiredSourceRef.current,
      zone: simZone,
      mock: mockRef.current,
      edgeTxVersion,
      radioId,
      modelPng: modelPngRef.current ?? undefined,
    });
  }, [
    active,
    edgeTxVersion,
    radioId,
    simZone,
    init,
    pause,
    resume,
    dispose,
    bootNonce,
  ]);

  useEffect(() => {
    return () => {
      dispose();
      startedRef.current = false;
      desiredSourceRef.current = "";
      appliedSourceRef.current = null;
      appliedModelPngRef.current = undefined;
      loadedFirmwareRef.current = null;
      loadedRadioRef.current = null;
      crashRetryCountRef.current = 0;
    };
  }, [dispose]);

  useEffect(() => {
    if (!active || state.phase !== "running") return;
    setMock(mock);
  }, [active, state.phase, mock, setMock]);

  useEffect(() => {
    if (!active) return;
    desiredSourceRef.current = luaSource;
    if (state.phase !== "running") return;
    const sourceSame = appliedSourceRef.current === desiredSourceRef.current;
    const pngSame = appliedModelPngRef.current === modelPng;
    if (sourceSame && pngSame) return;

    // Hot-reload: SimRuntime deploys a stable shim main.lua that loadScript()s
    // body.lua whenever gen.lua bumps — so FS rewrite alone updates pixels
    // without soft-restarting WASM (EdgeTX caches widget factories, #7216).
    const timer = window.setTimeout(() => {
      const nextSource = desiredSourceRef.current;
      const nextPng = modelPngRef.current;
      const nextSourceSame = appliedSourceRef.current === nextSource;
      const nextPngSame = appliedModelPngRef.current === nextPng;
      if (nextSourceSame && nextPngSame) {
        return;
      }
      const attemptId = ++hotReloadAttemptRef.current;
      // Skip PNG transfer when only Lua changed — avoids worker memory churn.
      void loadWidget(
        nextSource,
        simZone,
        nextPngSame ? undefined : (nextPng ?? undefined),
      )
        .then(() => {
          if (hotReloadAttemptRef.current !== attemptId) return;
          appliedSourceRef.current = nextSource;
          appliedModelPngRef.current = nextPng;
        })
        .catch(() => {
          // keep desired source; next running/source transition retries.
        });
    }, 180);

    return () => window.clearTimeout(timer);
  }, [active, state.phase, luaSource, loadWidget, simZone, modelPng]);

  const displayFrame = frame ?? lastGoodFrameRef.current;
  // Only flash "Updating…" during real WASM reboot (firmware/radio change),
  // not during body.lua hot-reloads which keep phase === "running".
  const isSoftRestarting =
    displayFrame != null &&
    (state.phase === "loading-wasm" || state.phase === "booting");

  if (state.phase === "error") {
    return (
      <div
        className={
          fillHost
            ? `${styles.simPreviewRoot} ${styles.simPreviewFill}`
            : styles.simPreviewRoot
        }
      >
        <div className={styles.radioSimMessage}>
          <p>Radio preview unavailable: {state.error}</p>
          <p className={styles.hint}>
            {autoRecovering
              ? "Restarting radio preview…"
              : "The sim worker crashed while updating the preview. Retry, or hard-refresh if this keeps happening."}
          </p>
          {!autoRecovering && (
            <button
              type="button"
              className={styles.radioSimRetry}
              onClick={() => {
                crashRetryCountRef.current = 0;
                setAutoRecovering(false);
                rebootSim();
              }}
            >
              Retry radio preview
            </button>
          )}
        </div>
      </div>
    );
  }

  if (
    (state.phase === "idle" ||
      state.phase === "loading-wasm" ||
      state.phase === "booting") &&
    !displayFrame
  ) {
    return (
      <div
        className={
          fillHost
            ? `${styles.simPreviewRoot} ${styles.simPreviewFill}`
            : styles.simPreviewRoot
        }
      >
        <div className={styles.radioSimMessage}>
          <div className={styles.radioSimBrand} aria-hidden>
            ETX
          </div>
          <p>{state.status || "Booting EdgeTX radio preview…"}</p>
          {wasmSizeMb != null && (
            <p className={styles.hint}>
              First load downloads ~{wasmSizeMb} MB of firmware (cached
              afterward).
            </p>
          )}
          {state.progress > 0 && (
            <div className={styles.radioSimProgress} aria-hidden>
              <div
                className={styles.radioSimProgressBar}
                style={{ width: `${state.progress}%` }}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        fillHost
          ? `${styles.simPreviewRoot} ${styles.simPreviewFill}`
          : styles.simPreviewRoot
      }
      data-testid="radio-sim-preview"
      data-sim-phase={state.phase}
    >
      <SimFrameCanvas
        frame={displayFrame}
        zone={frameZone}
        allowUpscale={fillHost}
        ignoreChatScrollPause={fillHost}
        canvasTestId={
          fillHost ? "editor-radio-preview" : "edgetx-widget-preview"
        }
      />
      <div
        className={styles.radioSimUpdating}
        aria-live="polite"
        data-testid="radio-sim-updating"
        hidden={!isSoftRestarting}
      >
        {isSoftRestarting ? "Updating radio preview…" : null}
      </div>

      {overlayOpen && radioProfile && (
        <SimInteractiveOverlay
          radioProfile={radioProfile}
          previewDims={previewDims}
          frame={displayFrame}
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
