"use client";

import type { TelemetryProtocol } from "@widget-gen/shared";
import type { InsertDrawKind } from "../elementMeta";
import { InsertMenu } from "./InsertMenu";
import styles from "../editor.module.css";

const SCENARIOS = [
  { id: "editor-preview", label: "Armed flight" },
  { id: "disarmed", label: "Disarmed" },
  { id: "low-battery", label: "Low battery" },
  { id: "weak-link", label: "Weak link" },
  { id: "gps-lost", label: "GPS lost" },
] as const;

interface EditorToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAdd: (kind: InsertDrawKind) => void;
  onAddPrefab?: (prefabId: string) => void;
  onSave: () => void;
  onValidate: () => void;
  saving: boolean;
  valid: boolean | null;
  protocol: TelemetryProtocol;
  onProtocolChange: (protocol: TelemetryProtocol) => void;
  onVerifySim: () => void;
  previewScenarioId: string;
  onPreviewScenarioChange: (id: string) => void;
}

export function EditorToolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAdd,
  onAddPrefab,
  onSave,
  onValidate,
  saving,
  valid,
  protocol,
  onProtocolChange,
  onVerifySim,
  previewScenarioId,
  onPreviewScenarioChange,
}: EditorToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarLeft}>
        <div className={styles.toolCluster} role="group" aria-label="History">
          <button
            type="button"
            className={styles.iconBtn}
            disabled={!canUndo}
            onClick={onUndo}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden
            >
              <path
                d="M3 6h7a3 3 0 1 1 0 6H8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M6 3 3 6l3 3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            disabled={!canRedo}
            onClick={onRedo}
            title="Redo (Ctrl+Y)"
            aria-label="Redo"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden
            >
              <path
                d="M13 6H6a3 3 0 1 0 0 6h2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="m10 3 3 3-3 3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div className={styles.toolbarDivider} aria-hidden />

        <InsertMenu onInsert={onAdd} onInsertPrefab={onAddPrefab} />

        <label className={styles.toolbarSelect}>
          <span className={styles.toolbarSelectLabel}>Protocol</span>
          <select
            value={protocol}
            onChange={(e) =>
              onProtocolChange(e.target.value as TelemetryProtocol)
            }
          >
            <option value="betaflight">Betaflight</option>
            <option value="rotorflight">Rotorflight</option>
            <option value="generic-crsf">Generic CRSF</option>
          </select>
        </label>

        <label className={styles.toolbarSelect}>
          <span className={styles.toolbarSelectLabel}>Scenario</span>
          <select
            value={previewScenarioId}
            onChange={(e) => onPreviewScenarioChange(e.target.value)}
            title="Mock telemetry scenario (canvas + sim)"
          >
            {SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.toolbarRight}>
        {valid === true && (
          <span className={`${styles.statusPill} ${styles.statusPillOk}`}>
            Valid
          </span>
        )}
        {valid === false && (
          <span className={`${styles.statusPill} ${styles.statusPillErr}`}>
            Invalid
          </span>
        )}
        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={onVerifySim}
        >
          <span className={styles.actionLabelFull}>Verify in sim</span>
          <span className={styles.actionLabelShort}>Sim</span>
        </button>
        <button
          type="button"
          className={`${styles.secondaryBtn} ${styles.hideOnNarrow}`}
          onClick={onValidate}
        >
          Validate
        </button>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={onSave}
          disabled={saving || valid === false}
          title={
            valid === false ? "Fix validation errors before saving" : undefined
          }
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
