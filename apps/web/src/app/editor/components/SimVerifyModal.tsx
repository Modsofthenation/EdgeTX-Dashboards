"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { hasColorWasmSim } from "@widget-gen/shared";
import {
  getPreviewScenario,
  type LayoutScenario,
} from "@widget-gen/layout-verify";
import styles from "../editor.module.css";

const RadioSimPreview = dynamic(
  () => import("~/components/RadioSimPreview").then((m) => m.RadioSimPreview),
  { ssr: false },
);

interface SimVerifyModalProps {
  source: string;
  open: boolean;
  onClose: () => void;
  reloadKey?: number;
  onReload?: () => void;
  scenarioId?: string;
  scenarioOverride?: LayoutScenario;
  layoutProfileId?: string;
  radioId?: string;
  modelPng?: Uint8Array | null;
  onRunningChange?: (running: boolean) => void;
}

export function SimVerifyModal({
  source,
  open,
  onClose,
  reloadKey = 0,
  onReload,
  scenarioId = "editor-preview",
  scenarioOverride,
  layoutProfileId = "tx15",
  radioId = "tx15",
  modelPng = null,
  onRunningChange,
}: SimVerifyModalProps) {
  const [interactiveControls, setInteractiveControls] = useState<{
    openInteractive: () => void;
  } | null>(null);

  if (!open) return null;
  const scenario = scenarioOverride ?? getPreviewScenario(scenarioId);
  const wasmReady = hasColorWasmSim(radioId);

  return (
    <div className={styles.modalBackdrop} role="presentation" onClick={onClose}>
      <div
        className={`${styles.modal} ${styles.simModal}`}
        role="dialog"
        aria-labelledby="sim-verify-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHead}>
          <h2 id="sim-verify-title" className={styles.modalTitle}>
            Run in simulator
          </h2>
          <button
            type="button"
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <p className={styles.modalHint}>
          {wasmReady
            ? "EdgeTX WASM preview using the same mock telemetry as the canvas. Reload after edits to refresh the sim. Use interactive sim for touch, keys, and sticks (Esc to close)."
            : `No color WASM firmware is mapped for radio "${radioId}" yet (B&W / mismatched LCD targets stay on the canvas parser). Color WASM: TX15, TX16S, T16, T18, X10, X12S.`}
          {wasmReady && modelPng
            ? " Custom model PNG is mounted at /IMAGES/simmodel.png."
            : wasmReady
              ? " Upload a model PNG from the toolbar to preview drawBitmap."
              : null}
        </p>
        <div className={styles.simModalBody}>
          {wasmReady ? (
            <RadioSimPreview
              key={`sim-${reloadKey}-${scenarioId}-${layoutProfileId}-${radioId}-${modelPng ? modelPng.byteLength : 0}`}
              luaSource={source}
              mock={scenario.mock}
              layoutProfileId={layoutProfileId}
              radioId={radioId}
              modelPng={modelPng}
              active={open}
              live
              fillHost
              onInteractiveControls={setInteractiveControls}
              onRunningChange={onRunningChange}
            />
          ) : (
            <p className={styles.modalHint}>
              Close this dialog and use the Layout canvas preview for geometry
              checks on this radio.
            </p>
          )}
        </div>
        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={onClose}
          >
            Close
          </button>
          {wasmReady && onReload ? (
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={onReload}
            >
              Reload
            </button>
          ) : null}
          {interactiveControls ? (
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={interactiveControls.openInteractive}
            >
              Open interactive sim
            </button>
          ) : null}
          <button type="button" className={styles.primaryBtn} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
