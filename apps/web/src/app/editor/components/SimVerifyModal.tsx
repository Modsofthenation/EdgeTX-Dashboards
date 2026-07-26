"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
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
  modelPng?: Uint8Array | null;
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
  modelPng = null,
}: SimVerifyModalProps) {
  const [interactiveControls, setInteractiveControls] = useState<{
    openInteractive: () => void;
  } | null>(null);

  if (!open) return null;
  const scenario = scenarioOverride ?? getPreviewScenario(scenarioId);

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
          EdgeTX WASM preview using the same mock telemetry as the canvas.
          Reload after edits to refresh the sim. Use interactive sim for touch,
          keys, and sticks (Esc to close).
          {modelPng
            ? " Custom model PNG is mounted at /IMAGES/simmodel.png."
            : " Upload a model PNG from the toolbar to preview drawBitmap."}
        </p>
        <div className={styles.simModalBody}>
          <RadioSimPreview
            key={`sim-${reloadKey}-${scenarioId}-${layoutProfileId}-${modelPng ? modelPng.byteLength : 0}`}
            luaSource={source}
            mock={scenario.mock}
            layoutProfileId={layoutProfileId}
            modelPng={modelPng}
            active={open}
            live
            fillHost
            onInteractiveControls={setInteractiveControls}
          />
        </div>
        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={onClose}
          >
            Close
          </button>
          {onReload ? (
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
