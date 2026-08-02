"use client";

import { useMemo, useRef, memo } from "react";
import type { TelemetryProtocol } from "@widget-gen/shared";
import type { InsertDrawKind } from "../elementMeta";
import { EditorMenu, type EditorMenuItem } from "./EditorMenu";
import { InsertMenu } from "./InsertMenu";
import { EDGE_TX_VERSION_OPTIONS } from "~/lib/edgeTxVersions";
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
  onAddFullRfHeliElectric?: () => void;
  onAddRfHeliNitro?: () => void;
  onAddQuadBoard?: (boardId: string) => void;
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
  edgeTxVersion: string;
  onEdgeTxVersionChange: (version: string) => void;
  previewScenarioId: string;
  onPreviewScenarioChange: (id: string) => void;
  liveTelemetryActive?: boolean;
  onToggleLiveTelemetry?: () => void;
  liveTelemetrySupported?: boolean;
  enrichRotorflight?: boolean;
  onEnrichChange?: (enabled: boolean) => void;
  modelPngName?: string | null;
  modelPngUrl?: string | null;
  onModelPngChange?: (file: File | null) => void;
  snapEnabled?: boolean;
  onSnapEnabledChange?: (enabled: boolean) => void;
  showSnapGuides?: boolean;
  onSnapGuidesChange?: (show: boolean) => void;
  inlineSim?: boolean;
  onInlineSimChange?: (enabled: boolean) => void;
  onAlign?: (mode: string) => void;
  onDistribute?: (mode: string) => void;
  canAlign?: boolean;
  canDistribute?: boolean;
}

export const EditorToolbar = memo(function EditorToolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAdd,
  onAddPrefab,
  onAddFullRfHeliElectric,
  onAddRfHeliNitro,
  onAddQuadBoard,
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
  edgeTxVersion,
  onEdgeTxVersionChange,
  previewScenarioId,
  onPreviewScenarioChange,
  liveTelemetryActive,
  onToggleLiveTelemetry,
  liveTelemetrySupported,
  enrichRotorflight,
  onEnrichChange,
  modelPngName,
  modelPngUrl,
  onModelPngChange,
  snapEnabled,
  onSnapEnabledChange,
  showSnapGuides,
  onSnapGuidesChange,
  inlineSim,
  onInlineSimChange,
  onAlign,
  onDistribute,
  canAlign,
  canDistribute,
}: EditorToolbarProps) {
  const modelFileRef = useRef<HTMLInputElement>(null);

  const alignItems = useMemo((): EditorMenuItem[] => {
    if (!onAlign) return [];
    const items: EditorMenuItem[] = [
      {
        id: "left",
        label: canAlign ? "Align left" : "Align left (select a layer first)",
        disabled: !canAlign,
        onClick: () => onAlign("left"),
      },
      {
        id: "center-x",
        label: canAlign
          ? "Align center"
          : "Align center (select a layer first)",
        disabled: !canAlign,
        onClick: () => onAlign("center-x"),
      },
      {
        id: "right",
        label: canAlign ? "Align right" : "Align right (select a layer first)",
        disabled: !canAlign,
        onClick: () => onAlign("right"),
      },
      {
        id: "top",
        label: canAlign ? "Align top" : "Align top (select a layer first)",
        disabled: !canAlign,
        onClick: () => onAlign("top"),
      },
      {
        id: "center-y",
        label: canAlign
          ? "Align middle"
          : "Align middle (select a layer first)",
        disabled: !canAlign,
        onClick: () => onAlign("center-y"),
      },
      {
        id: "bottom",
        label: canAlign
          ? "Align bottom"
          : "Align bottom (select a layer first)",
        disabled: !canAlign,
        onClick: () => onAlign("bottom"),
      },
    ];
    if (onDistribute) {
      items.push(
        {
          id: "dist-h",
          label: canDistribute
            ? "Distribute horizontally"
            : "Distribute horizontally (select 3+ layers)",
          disabled: !canDistribute,
          separatorBefore: true,
          onClick: () => onDistribute("horizontal"),
        },
        {
          id: "dist-v",
          label: canDistribute
            ? "Distribute vertically"
            : "Distribute vertically (select 3+ layers)",
          disabled: !canDistribute,
          onClick: () => onDistribute("vertical"),
        },
      );
    }
    return items;
  }, [onAlign, onDistribute, canAlign, canDistribute]);

  const projectItems = useMemo((): EditorMenuItem[] => {
    const items: EditorMenuItem[] = [];
    if (onOpenLast) {
      items.push({
        id: "open-last",
        label: "Open last project",
        onClick: onOpenLast,
      });
    }
    if (onOpenRecent) {
      items.push({
        id: "recent",
        label: "Recent projects…",
        onClick: onOpenRecent,
      });
    }
    if (onSaveNamed) {
      items.push({
        id: "save-as",
        label: "Save as…",
        separatorBefore: items.length > 0,
        onClick: onSaveNamed,
      });
    }
    return items;
  }, [onOpenLast, onOpenRecent, onSaveNamed]);

  const viewItems = useMemo((): EditorMenuItem[] => {
    const items: EditorMenuItem[] = [];
    if (onSnapEnabledChange) {
      items.push({
        id: "snap",
        label: "Snap to guides",
        onClick: () => onSnapEnabledChange(!snapEnabled),
      });
    }
    if (onSnapGuidesChange) {
      items.push({
        id: "snap-guides",
        label: "Show snap guides",
        onClick: () => onSnapGuidesChange(!showSnapGuides),
      });
    }
    if (onInlineSimChange) {
      items.push({
        id: "inline-sim",
        label: inlineSim ? "Hide radio preview" : "Show radio preview",
        onClick: () => onInlineSimChange(!inlineSim),
      });
    }
    if (onModelPngChange) {
      items.push({
        id: "png",
        label: modelPngName ? `Replace model PNG…` : "Upload model PNG…",
        separatorBefore: items.length > 0,
        onClick: () => modelFileRef.current?.click(),
      });
      if (modelPngName) {
        items.push({
          id: "png-clear",
          label: `Clear PNG (${modelPngName})`,
          onClick: () => onModelPngChange(null),
        });
      }
    }
    return items;
  }, [
    onSnapEnabledChange,
    snapEnabled,
    onSnapGuidesChange,
    showSnapGuides,
    onInlineSimChange,
    inlineSim,
    onModelPngChange,
    modelPngName,
  ]);

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
          onInsertFullRfHeliElectric={onAddFullRfHeliElectric}
          onInsertRfHeliNitro={onAddRfHeliNitro}
          onInsertQuadBoard={onAddQuadBoard}
          onInsertCompanionSuite={onAddCompanionSuite}
          companionSuiteIds={companionSuiteIds}
        />

        {alignItems.length > 0 ? (
          <EditorMenu
            label="Align"
            items={alignItems}
            title={
              canAlign
                ? "Align selection (1 → canvas, 2+ → each other) or distribute (3+)"
                : "Select a layer, then Align to pin it to the canvas edges"
            }
          />
        ) : null}

        {viewItems.length > 0 ? (
          <EditorMenu
            label="View"
            shortLabel="View"
            items={viewItems}
            title="Canvas aids and model image"
          />
        ) : null}

        {modelPngUrl ? (
          <img
            src={modelPngUrl}
            alt=""
            className={styles.modelPngThumb}
            title={modelPngName ?? "Model PNG"}
          />
        ) : null}

        {onModelPngChange ? (
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
        ) : null}

        <div className={styles.toolbarDivider} aria-hidden />

        <label
          className={styles.toolbarSelect}
          title="Telemetry catalog used for sensor pickers and validation"
        >
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

        <label
          className={styles.toolbarSelect}
          title="EdgeTX firmware target for Lua autocomplete (sim uses nearest available WASM)"
        >
          <span className={styles.toolbarSelectLabel}>EdgeTX</span>
          <select
            value={edgeTxVersion}
            onChange={(e) => onEdgeTxVersionChange(e.target.value)}
            data-testid="editor-edgetx-version"
          >
            {EDGE_TX_VERSION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
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
            className={
              liveTelemetryActive ? styles.toolbarToggleOn : styles.secondaryBtn
            }
            onClick={onToggleLiveTelemetry}
            disabled={!liveTelemetrySupported && !liveTelemetryActive}
            title={
              liveTelemetrySupported
                ? "Stream CRSF/ELRS over Web Serial into the preview"
                : "Web Serial requires Chrome/Edge on desktop"
            }
          >
            {liveTelemetryActive ? "Live on" : "Live"}
          </button>
        ) : null}

        {protocol === "rotorflight" && onEnrichChange ? (
          <label
            className={styles.toolbarCheck}
            title="Fill missing HSpd/Gov/Vbec from CRSF heuristics while live"
          >
            <input
              type="checkbox"
              checked={enrichRotorflight !== false}
              onChange={(e) => onEnrichChange(e.target.checked)}
            />
            <span>Enrich RF</span>
          </label>
        ) : null}
      </div>

      <div className={styles.toolbarRight}>
        {valid === true && (
          <span
            className={`${styles.statusPill} ${styles.statusPillOk}`}
            data-testid="editor-validation-status"
            title="Lua passed structure, telemetry, and draw checks"
          >
            Valid
          </span>
        )}
        {valid === false && (
          <span
            className={`${styles.statusPill} ${styles.statusPillErr}`}
            data-testid="editor-validation-status"
            title="Validation found errors — open Validate for details"
          >
            Invalid
          </span>
        )}
        {projectItems.length > 0 ? (
          <EditorMenu
            label="Project"
            shortLabel="Proj"
            items={projectItems}
            align="right"
            title="Open or rename projects"
          />
        ) : null}
        <button
          type="button"
          className={`${styles.secondaryBtn} ${styles.hideOnNarrow}`}
          onClick={onValidate}
          title="Run EdgeTX widget validation (structure, sensors, draws)"
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
});
