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
  /**
   * Reorder in the visual list (top = front). `place: "before"` drops above
   * the target row; `"after"` drops below.
   */
  onReorder?: (
    draggedId: string,
    targetId: string,
    place: "before" | "after",
  ) => void;
}

export function RecordLayersPanel({
  records,
  selectedIds,
  onSelect,
  onDelete,
  onMoveUp,
  onMoveDown,
  onReorder,
}: RecordLayersPanelProps) {
  const [filter, setFilter] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<{
    id: string;
    place: "before" | "after";
  } | null>(null);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const rows = [...records].reverse();
    if (!q) return rows;
    return rows.filter((r) => recordLayerLabel(r).toLowerCase().includes(q));
  }, [records, filter]);

  const canDragReorder = Boolean(onReorder) && filter.trim() === "";

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

      {canDragReorder ? (
        <p className={styles.layerDragHint}>Drag rows to change draw order</p>
      ) : null}

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
            const isDragging = draggingId === record.id;
            const hint =
              dropHint?.id === record.id && draggingId !== record.id
                ? dropHint.place
                : null;
            return (
              <li
                key={record.id}
                className={[
                  styles.layerItem,
                  selected ? styles.layerItemSelected : "",
                  isDragging ? styles.layerItemDragging : "",
                  hint === "before" ? styles.layerItemDropBefore : "",
                  hint === "after" ? styles.layerItemDropAfter : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                draggable={canDragReorder}
                onDragStart={(e) => {
                  if (!canDragReorder) return;
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", record.id);
                  setDraggingId(record.id);
                  setDropHint(null);
                }}
                onDragEnd={() => {
                  setDraggingId(null);
                  setDropHint(null);
                }}
                onDragOver={(e) => {
                  if (!canDragReorder || !draggingId || draggingId === record.id)
                    return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  const rect = (
                    e.currentTarget as HTMLElement
                  ).getBoundingClientRect();
                  const place: "before" | "after" =
                    e.clientY < rect.top + rect.height / 2 ? "before" : "after";
                  setDropHint({ id: record.id, place });
                }}
                onDragLeave={(e) => {
                  if (
                    dropHint?.id === record.id &&
                    !(e.currentTarget as HTMLElement).contains(
                      e.relatedTarget as Node,
                    )
                  ) {
                    setDropHint(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!canDragReorder || !onReorder) return;
                  const draggedId =
                    e.dataTransfer.getData("text/plain") || draggingId;
                  if (!draggedId || draggedId === record.id) {
                    setDraggingId(null);
                    setDropHint(null);
                    return;
                  }
                  const rect = (
                    e.currentTarget as HTMLElement
                  ).getBoundingClientRect();
                  const place: "before" | "after" =
                    dropHint?.id === record.id
                      ? dropHint.place
                      : e.clientY < rect.top + rect.height / 2
                        ? "before"
                        : "after";
                  onReorder(draggedId, record.id, place);
                  setDraggingId(null);
                  setDropHint(null);
                }}
              >
                {canDragReorder ? (
                  <span
                    className={styles.layerDragHandle}
                    title="Drag to reorder"
                    aria-hidden
                  >
                    ⋮⋮
                  </span>
                ) : null}
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
