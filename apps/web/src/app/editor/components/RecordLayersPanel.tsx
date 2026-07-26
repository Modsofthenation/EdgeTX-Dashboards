"use client";

import { useMemo, useState } from "react";
import type { DocumentRecord } from "@widget-gen/editor-core";
import { recordLayerLabel } from "@widget-gen/editor-core";
import { catalogForDrawKind } from "../elementMeta";
import styles from "../editor.module.css";

interface RecordLayersPanelProps {
  records: DocumentRecord[];
  selectedIds: string[];
  onSelect: (id: string, additive: boolean) => void;
  onDelete: (id: string) => void;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
}

export function RecordLayersPanel({
  records,
  selectedIds,
  onSelect,
  onDelete,
  onMoveUp,
  onMoveDown,
}: RecordLayersPanelProps) {
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const rows = [...records].reverse();
    if (!q) return rows;
    return rows.filter((r) => recordLayerLabel(r).toLowerCase().includes(q));
  }, [records, filter]);

  return (
    <aside className={`${styles.sidePanel} ${styles.layersPanel}`}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Layers</h2>
        <span className={styles.panelBadge}>{records.length}</span>
      </div>

      <div className={styles.searchWrap}>
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Filter layers…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter layers"
        />
      </div>

      {records.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>No drawable layers</p>
          <p className={styles.emptyHint}>
            Lines the interpreter cannot parse stay in Lua but are not editable
            here.
          </p>
        </div>
      ) : (
        <ul className={styles.layerList}>
          {filtered.map((record) => {
            const selected = selectedIds.includes(record.id);
            const meta = catalogForDrawKind(record.kind);
            return (
              <li
                key={record.id}
                className={`${styles.layerItem} ${selected ? styles.layerItemSelected : ""}`}
              >
                <button
                  type="button"
                  className={styles.layerSelect}
                  onClick={(e) =>
                    onSelect(record.id, e.shiftKey || e.metaKey || e.ctrlKey)
                  }
                >
                  <span className={styles.layerKindIcon} aria-hidden>
                    {meta?.shortLabel ?? "?"}
                  </span>
                  <span className={styles.layerLabel}>
                    {recordLayerLabel(record)}
                  </span>
                  <span className={styles.layerKindTag}>{record.kind}</span>
                </button>
                <div className={styles.layerActions}>
                  {onMoveUp ? (
                    <button
                      type="button"
                      className={styles.layerActionBtn}
                      title="Bring forward"
                      aria-label="Bring layer forward"
                      onClick={() => onMoveUp(record.id)}
                    >
                      ↑
                    </button>
                  ) : null}
                  {onMoveDown ? (
                    <button
                      type="button"
                      className={styles.layerActionBtn}
                      title="Send backward"
                      aria-label="Send layer backward"
                      onClick={() => onMoveDown(record.id)}
                    >
                      ↓
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={`${styles.layerActionBtn} ${styles.layerActionDanger}`}
                    title="Delete line"
                    aria-label="Delete layer"
                    onClick={() => onDelete(record.id)}
                  >
                    ×
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
