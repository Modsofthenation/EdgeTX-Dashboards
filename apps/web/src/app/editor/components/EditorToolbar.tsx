"use client";

import { useRef } from "react";
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
  onAddFullStacyDash?: () => void;
  onAddNitroStacyDash?: () => void;
  onAddCompanionSuite?: (suiteId: string) => void;
  companionSuiteIds?: string[];
  onSave: () => void;
  onSaveNamed?: () => void;
  onOpenRecent?: () => void;
  onOpenLast?: () => void;
  onValidate: () => void;
  saving: boolean;
  valid: boolean | null;
  protocol: TelemetryProtocol;
  onProtocolChange: (protocol: TelemetryProtocol) => void;
  onVerifySim: () => void;
  previewScenarioId: string;
  onPreviewScenarioChange: (id: string) => void;
  liveTelemetryActive?: boolean;
  onToggleLiveTelemetry?: () => void;
  liveTelemetrySupported?: boolean;
  modelPngName?: string | null;
  onModelPngChange?: (file: File | null) => void;
  onAlign?: (mode: string) => void;
  onDistribute?: (mode: string) => void;
  canAlign?: boolean;
  canDistribute?: boolean;
}

export function EditorToolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAdd,
  onAddPrefab,
  onAddFullStacyDash,
  onAddNitroStacyDash,
  onAddCompanionSuite,
  companionSuiteIds,
  onSave,
  onSaveNamed,
  onOpenRecent,
  onOpenLast,
  onValidate,
  saving,
  valid,
  protocol,
  onProtocolChange,
  onVerifySim,
  previewScenarioId,
  onPreviewScenarioChange,
  liveTelemetryActive,
  onToggleLiveTelemetry,
  liveTelemetrySupported,
  modelPngName,
  onModelPngChange,
  onAlign,
  onDistribute,
  canAlign,
  canDistribute,
}: EditorToolbarProps) {
  const modelFileRef = useRef<HTMLInputElement>(null);
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

        <InsertMenu
          protocol={protocol}
          onInsert={onAdd}
          onInsertPrefab={onAddPrefab}
          onInsertFullStacyDash={onAddFullStacyDash}
          onInsertNitroStacyDash={onAddNitroStacyDash}
          onInsertCompanionSuite={onAddCompanionSuite}
          companionSuiteIds={companionSuiteIds}
        />

        {onAlign ? (
          <div className={styles.toolCluster} role="group" aria-label="Align">
            <button
              type="button"
              className={styles.iconBtn}
              disabled={!canAlign}
              title="Align left"
              onClick={() => onAlign("left")}
            >
              ⟸
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              disabled={!canAlign}
              title="Align center X"
              onClick={() => onAlign("center-x")}
            >
              ↔
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              disabled={!canAlign}
              title="Align right"
              onClick={() => onAlign("right")}
            >
              ⟹
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              disabled={!canAlign}
              title="Align top"
              onClick={() => onAlign("top")}
            >
              ⟰
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              disabled={!canAlign}
              title="Align bottom"
              onClick={() => onAlign("bottom")}
            >
              ⟱
            </button>
            {onDistribute ? (
              <>
                <button
                  type="button"
                  className={styles.iconBtn}
                  disabled={!canDistribute}
                  title="Distribute horizontally"
                  onClick={() => onDistribute("horizontal")}
                >
                  ⇔
                </button>
                <button
                  type="button"
                  className={styles.iconBtn}
                  disabled={!canDistribute}
                  title="Distribute vertically"
                  onClick={() => onDistribute("vertical")}
                >
                  ⇕
                </button>
              </>
            ) : null}
          </div>
        ) : null}

        {onModelPngChange ? (
          <>
            <button
              type="button"
              className={styles.secondaryBtn}
              title="PNG for sim SD /IMAGES/simmodel.png (drawBitmap)"
              onClick={() => modelFileRef.current?.click()}
            >
              {modelPngName ? `PNG: ${modelPngName}` : "Model PNG…"}
            </button>
            <input
              ref={modelFileRef}
              type="file"
              accept="image/png"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                e.target.value = "";
                onModelPngChange(file);
              }}
            />
            {modelPngName ? (
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={() => onModelPngChange(null)}
              >
                Clear PNG
              </button>
            ) : null}
          </>
        ) : null}

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
            disabled={Boolean(liveTelemetryActive)}
          >
            {SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        {onToggleLiveTelemetry ? (
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={onToggleLiveTelemetry}
            disabled={!liveTelemetrySupported && !liveTelemetryActive}
            title={
              liveTelemetrySupported
                ? "Stream CRSF/ELRS over Web Serial into the preview"
                : "Web Serial requires Chrome/Edge on desktop"
            }
          >
            {liveTelemetryActive ? "Live: on" : "Live radio"}
          </button>
        ) : null}
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
        {onOpenLast ? (
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={onOpenLast}
            title="Open last project"
          >
            Open last
          </button>
        ) : null}
        {onOpenRecent ? (
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={onOpenRecent}
          >
            Recent
          </button>
        ) : null}
        {onSaveNamed ? (
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={onSaveNamed}
          >
            Save as…
          </button>
        ) : null}
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
            valid === false
              ? "Fix validation errors before saving"
              : "Save (Ctrl+S)"
          }
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
