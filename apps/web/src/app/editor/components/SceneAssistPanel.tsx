"use client";

import { useMemo, useState } from "react";
import type { DocumentRecord, LuaToSceneResult } from "@widget-gen/editor-core";
import styles from "../editor.module.css";

interface SceneAssistPanelProps {
  assist: LuaToSceneResult | null;
  records: DocumentRecord[];
  selectedIds: string[];
  onSelectRecord: (id: string) => void;
}

function elementLabel(el: LuaToSceneResult["scene"]["elements"][number]): string {
  if (el.label) return el.label;
  if (el.kind === "text" && "content" in el && el.content) {
    return el.content.slice(0, 24);
  }
  return el.kind;
}

export function SceneAssistPanel({
  assist,
  records,
  selectedIds,
  onSelectRecord,
}: SceneAssistPanelProps) {
  const [open, setOpen] = useState(false);

  const stats = useMemo(() => {
    if (!assist) return null;
    const { scene, warnings } = assist;
    const low = scene.elements.filter((e) => e.importConfidence === "low").length;
    const linked = scene.elements.filter((e) => e.sourceLine != null).length;
    return {
      name: scene.name,
      elements: scene.elements.length,
      options: scene.options.length,
      telemetry: scene.telemetry.length,
      records: records.length,
      low,
      linked,
      warnings,
      mismatch: scene.elements.length !== records.length,
    };
  }, [assist, records.length]);

  if (!assist || !stats) return null;

  return (
    <div className={styles.sceneAssist} role="region" aria-label="Scene assist">
      <div className={styles.sceneAssistBar}>
        <span>
          Scene assist: <strong>{stats.name}</strong> · {stats.elements} scene
          elements · {stats.records} draw records · {stats.options} options
          {stats.low > 0 ? ` · ${stats.low} low-confidence` : ""}
          {stats.mismatch ? " · count mismatch" : ""}
        </span>
        <button
          type="button"
          className={styles.calloutLink}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide" : "Details"}
        </button>
      </div>
      {open ? (
        <div className={styles.sceneAssistBody}>
          <p className={styles.sceneAssistNote}>
            Lua remains the edit source of truth. Click a node to select its
            matching draw record (L#line).
          </p>
          {stats.warnings.length > 0 ? (
            <ul className={styles.sceneAssistWarnings}>
              {stats.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : (
            <p className={styles.calloutMuted}>No import warnings.</p>
          )}
          <ul className={styles.sceneAssistList}>
            {assist.scene.elements.map((el) => {
              const recordId =
                el.sourceLine != null ? `L${el.sourceLine}` : null;
              const selected = recordId
                ? selectedIds.includes(recordId)
                : false;
              return (
                <li key={el.id}>
                  <button
                    type="button"
                    className={
                      selected
                        ? styles.sceneAssistItemSelected
                        : styles.sceneAssistItem
                    }
                    disabled={!recordId}
                    title={
                      recordId
                        ? `Select ${recordId}`
                        : "No source line for this element"
                    }
                    onClick={() => {
                      if (recordId) onSelectRecord(recordId);
                    }}
                  >
                    <span className={styles.sceneAssistKind}>{el.kind}</span>
                    <span className={styles.sceneAssistLabel}>
                      {elementLabel(el)}
                    </span>
                    <span className={styles.sceneAssistMeta}>
                      {recordId ?? "—"}
                      {el.importConfidence === "low" ? " · low" : ""}
                      {el.optionGate ? ` · ${el.optionGate}` : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
