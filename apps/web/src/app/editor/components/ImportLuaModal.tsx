"use client";

import { memo } from "react";
import styles from "../editor.module.css";

export const ImportLuaModal = memo(function ImportLuaModal({
  open,
  pasteText,
  onPasteTextChange,
  onClose,
  onImport,
}: {
  open: boolean;
  pasteText: string;
  onPasteTextChange: (text: string) => void;
  onClose: () => void;
  onImport: () => void;
}) {
  if (!open) return null;

  return (
    <div className={styles.modalBackdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-labelledby="import-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHead}>
          <h2 id="import-title" className={styles.modalTitle}>
            Import Lua
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
          Paste an EdgeTX widget <code>main.lua</code>. The editor patches draw
          lines in place.
        </p>
        <textarea
          className={styles.modalTextarea}
          value={pasteText}
          onChange={(e) => onPasteTextChange(e.target.value)}
          placeholder="---@type WidgetScript&#10;---@simulate Layout1x1 zone=0&#10;..."
          rows={12}
          autoFocus
        />
        <div className={styles.modalActions}>
          <button type="button" className={styles.ghostBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={onImport}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
});
