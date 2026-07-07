"use client";

import { useMemo, useState } from "react";
import type { EditorElement } from "@widget-gen/editor-core";
import { catalogForKind, layerLabel } from "../elementMeta";
import styles from "../editor.module.css";

interface LayersPanelProps {
  elements: EditorElement[];
  selectedIds: string[];
  onSelect: (id: string, additive: boolean) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onToggleVisible: (id: string) => void;
  onDelete: (id: string) => void;
}

export function LayersPanel({
  elements,
  selectedIds,
  onSelect,
  onReorder,
  onToggleVisible,
  onDelete,
}: LayersPanelProps) {
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const rows = [...elements].reverse().map((el, revIndex) => ({
      el,
      index: elements.length - 1 - revIndex,
    }));
    if (!q) return rows;
    return rows.filter(({ el }) => layerLabel(el).toLowerCase().includes(q));
  }, [elements, filter]);

  return (
    <aside className={`${styles.sidePanel} ${styles.layersPanel}`}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Layers</h2>
        <span className={styles.panelBadge}>{elements.length}</span>
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

      {elements.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>No elements yet</p>
          <p className={styles.emptyHint}>Use Insert to add text, cards, gauges, and more.</p>
        </div>
      ) : (
        <ul className={`${styles.layerList} appScrollbar`}>
          {filtered.map(({ el, index }) => {
            const selected = selectedIds.includes(el.id);
            const meta = catalogForKind(el.kind);
            return (
              <li
                key={el.id}
                className={`${styles.layerItem} ${selected ? styles.layerItemSelected : ""} ${!el.visible ? styles.layerItemHidden : ""}`}
              >
                <button
                  type="button"
                  className={styles.layerSelect}
                  onClick={(e) => onSelect(el.id, e.shiftKey)}
                >
                  <span className={styles.layerKindIcon} aria-hidden>
                    {meta?.shortLabel ?? "?"}
                  </span>
                  <span className={styles.layerLabel}>{layerLabel(el)}</span>
                  <span className={styles.layerKindTag}>{el.kind}</span>
                </button>
                <div className={styles.layerActions}>
                  <button
                    type="button"
                    className={styles.layerActionBtn}
                    title="Bring forward"
                    aria-label="Bring forward"
                    onClick={() => onReorder(index, index + 1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={styles.layerActionBtn}
                    title="Send backward"
                    aria-label="Send backward"
                    onClick={() => onReorder(index, index - 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={`${styles.layerActionBtn} ${el.visible ? styles.layerActionOn : ""}`}
                    title={el.visible ? "Hide" : "Show"}
                    aria-label={el.visible ? "Hide layer" : "Show layer"}
                    onClick={() => onToggleVisible(el.id)}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                      {el.visible ? (
                        <>
                          <path
                            d="M1 8s2.5-4 7-4 7 4 7 4-2.5 4-7 4-7-4-7-4Z"
                            stroke="currentColor"
                            strokeWidth="1.25"
                          />
                          <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.25" />
                        </>
                      ) : (
                        <path
                          d="M2 2l12 12M6.7 6.8A2 2 0 0 0 8 10a2 2 0 0 0 1.8-1.1M4.2 4.5C2.8 5.4 1.6 6.7 1 8c0 0 2.5 4 7 4 1.1 0 2.1-.2 3-.6M11.5 11.1c1.3-.9 2.3-2 3-3.1 0 0-2.5-4-7-4-.8 0-1.5.1-2.2.3"
                          stroke="currentColor"
                          strokeWidth="1.25"
                          strokeLinecap="round"
                        />
                      )}
                    </svg>
                  </button>
                  <button
                    type="button"
                    className={`${styles.layerActionBtn} ${styles.layerActionDanger}`}
                    title="Delete"
                    aria-label="Delete layer"
                    onClick={() => onDelete(el.id)}
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
