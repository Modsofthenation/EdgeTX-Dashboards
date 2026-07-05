"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { resolvePreviewDimensions, getSimulateLayoutProfile } from "@widget-gen/shared";
import type { MockTelemetryValues, SimFrameData, SimKeyboardMode } from "@widget-gen/sim-preview";
import type { RadioProfile } from "@edgetx/simulator-ui";
import { useRadioSim, type FrameSubscriber } from "@/lib/radioSim/useRadioSim";
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
  mock: MockTelemetryValues;
  live?: boolean;
  active: boolean;
}

function SimInteractiveOverlay({
  radioProfile,
  previewDims,
  live,
  running,
  simState,
  keyboardMode,
  onClose,
  onInput,
  subscribeFrames,
}: {
  radioProfile: RadioProfile;
  previewDims: ReturnType<typeof resolvePreviewDimensions>;
  live: boolean;
  running: boolean;
  simState: { loading: boolean; error: string | null; progress: number; status: string };
  keyboardMode: SimKeyboardMode;
  onClose: () => void;
  onInput: (msg: object) => void;
  subscribeFrames: (subscriber: FrameSubscriber | null) => void;
}) {
  const [frame, setFrame] = useState<SimFrameData | null>(null);

  useEffect(() => {
    subscribeFrames((next) => setFrame(next));
    return () => subscribeFrames(null);
  }, [subscribeFrames]);

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
          {previewDims.lcdW} × {previewDims.lcdH} · EdgeTX WASM · {previewDims.layout} z
          {previewDims.zone}
          {live && running && <span className={styles.radioSimLiveTag}> · Live mock telemetry</span>}
        </span>
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
  mock,
  live = true,
  active,
}: RadioSimPreviewProps) {
  const {
    state,
    wasmSizeMb,
    keyboardMode,
    init,
    loadWidget,
    setMock,
    sendInput,
    pause,
    resume,
    subscribeFrames,
    dispose,
  } = useRadioSim();
  const startedRef = useRef(false);
  const loadedSourceRef = useRef<string | null>(null);
  const sendInputRef = useRef(sendInput);
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
    }),
    [previewDims]
  );

  const simState = useMemo(
    () => ({
      loading: state.phase === "loading-wasm" || state.phase === "booting",
      error: state.error,
      progress: state.progress,
      status: state.status,
    }),
    [state]
  );

  useEffect(() => {
    if (!active) {
      pause();
      setOverlayOpen(false);
      return;
    }

    resume();
    if (!startedRef.current) {
      startedRef.current = true;
      loadedSourceRef.current = luaSource;
      init({
        source: luaSource,
        zone: simZone,
        mock,
      });
    }
  }, [active, init, pause, resume, luaSource, simZone, mock]);

  useEffect(() => {
    return () => {
      dispose();
      startedRef.current = false;
      loadedSourceRef.current = null;
    };
  }, [dispose]);

  useEffect(() => {
    if (!active || state.phase !== "running") return;
    setMock(mock);
  }, [active, state.phase, mock, setMock]);

  useEffect(() => {
    if (!active || state.phase !== "running") return;
    if (loadedSourceRef.current === luaSource) return;
    loadedSourceRef.current = luaSource;
    loadWidget(luaSource, simZone);
  }, [active, state.phase, luaSource, loadWidget, simZone]);

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
      <div className={styles.radioSimInlineRunning}>
        <p className={styles.radioSimInlineStatus}>EdgeTX simulator running</p>
        <button
          type="button"
          className={styles.radioSimInlineOpen}
          onClick={() => setOverlayOpen(true)}
        >
          Open interactive sim
        </button>
      </div>

      {overlayOpen && radioProfile && (
        <SimInteractiveOverlay
          radioProfile={radioProfile}
          previewDims={previewDims}
          live={live}
          running={state.phase === "running"}
          simState={simState}
          keyboardMode={keyboardMode}
          onClose={() => setOverlayOpen(false)}
          onInput={stableSendInput}
          subscribeFrames={subscribeFrames}
        />
      )}
    </>
  );
}
