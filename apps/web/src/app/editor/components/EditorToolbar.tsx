"use client";

import type { ElementKind } from "@widget-gen/editor-core";
import { InsertMenu } from "./InsertMenu";
import styles from "../editor.module.css";

interface EditorToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAdd: (kind: ElementKind) => void;
  onSave: () => void;
  onValidate: () => void;
  saving: boolean;
  valid: boolean | null;
}

export function EditorToolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAdd,
  onSave,
  onValidate,
  saving,
  valid,
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
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
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
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
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

        <InsertMenu onInsert={onAdd} />
      </div>

      <div className={styles.toolbarRight}>
        {valid === true && (
          <span className={`${styles.statusPill} ${styles.statusPillOk}`}>Valid</span>
        )}
        {valid === false && (
          <span className={`${styles.statusPill} ${styles.statusPillErr}`}>Invalid</span>
        )}
        <button type="button" className={styles.secondaryBtn} onClick={onValidate}>
          Validate
        </button>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={onSave}
          disabled={saving || valid === false}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

export type { ElementKind };
