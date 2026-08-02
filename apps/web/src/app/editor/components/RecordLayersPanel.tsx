"use client";

import { Fragment, memo, useMemo, useRef, useState } from "react";
import type { DocumentRecord } from "@widget-gen/editor-core";
import {
  getPrefabSection,
  listPrefabSpans,
  recordLayerLabel,
} from "@widget-gen/editor-core";
import { catalogForDrawKind } from "../elementMeta";
import {
  cacheLayerDropRects,
  resolveLayerDropTarget,
  sameLayerDropHint,
  type LayerDropHint,
  type LayerDropRect,
} from "../lib/layerDropTarget";
import styles from "../editor.module.css";

interface RecordLayersPanelProps {
  records: DocumentRecord[];
  source?: string;
  selectedIds: string[];
  onSelect: (id: string, additive: boolean) => void;
  onSelectMany?: (ids: string[], additive: boolean) => void;
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
  onClearAll?: () => void;
}

export const RecordLayersPanel = memo(function RecordLayersPanel({
  records,
  source,
  selectedIds,
  onSelect,
  onSelectMany,
  onDelete,
  onMoveUp,
  onMoveDown,
  onReorder,
  onClearAll,
}: RecordLayersPanelProps) {
  const [filter, setFilter] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<LayerDropHint | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const dragIdRef = useRef<string | null>(null);
  const dropHintRef = useRef<LayerDropHint | null>(null);
  const dropRectsRef = useRef<LayerDropRect[]>([]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const prefabSpans = useMemo(
    () => (source ? listPrefabSpans(source) : []),
    [source],
  );

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const rows = records.toReversed();
    if (!q) return rows;
    return rows.filter((r) => recordLayerLabel(r).toLowerCase().includes(q));
  }, [records, filter]);

  const canDragReorder = Boolean(onReorder) && filter.trim() === "";

  const recordSourceLine = (record: DocumentRecord) =>
    record.sourceLine ?? record.sourceRef?.sourceLine;

  const spanRecordIdsByKey = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const span of prefabSpans) {
      const key = `${span.startLine}:${span.endLine}`;
      map.set(
        key,
        records
          .filter((record) => {
            const line = recordSourceLine(record);
            return (
              line != null && line >= span.startLine && line <= span.endLine
            );
          })
          .map((record) => record.id),
      );
    }
    return map;
  }, [prefabSpans, records]);

  const refreshDropRects = () => {
    dropRectsRef.current = listRef.current
      ? cacheLayerDropRects(listRef.current)
      : [];
  };

  const clearDrag = () => {
    listRef.current?.removeEventListener("scroll", refreshDropRects);
    dragIdRef.current = null;
    dropHintRef.current = null;
    dropRectsRef.current = [];
    setDraggingId(null);
    setDropHint(null);
  };

  const updateDropFromPoint = (clientY: number) => {
    const draggedId = dragIdRef.current;
    if (!draggedId) return;
    const next = resolveLayerDropTarget(
      clientY,
      dropRectsRef.current,
      draggedId,
    );
    if (sameLayerDropHint(dropHintRef.current, next)) return;
    dropHintRef.current = next;
    setDropHint(next);
  };

  const onHandlePointerDown = (event: React.PointerEvent, recordId: string) => {
    if (!canDragReorder || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    dragIdRef.current = recordId;
    dropHintRef.current = null;
    refreshDropRects();
    // Viewport rects go stale if the list scrolls mid-drag.
    listRef.current?.addEventListener("scroll", refreshDropRects, {
      passive: true,
    });
    setDraggingId(recordId);
    setDropHint(null);
    onSelect(recordId, false);
  };

  const onHandlePointerMove = (event: React.PointerEvent) => {
    if (!dragIdRef.current) return;
    updateDropFromPoint(event.clientY);
  };

  const onHandlePointerUp = (event: React.PointerEvent) => {
    if (!dragIdRef.current) return;
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(
        event.pointerId,
      );
    } catch {
      /* already released */
    }
    updateDropFromPoint(event.clientY);
    const draggedId = dragIdRef.current;
    const hint = dropHintRef.current;
    clearDrag();
    if (draggedId && hint && onReorder && hint.id !== draggedId) {
      onReorder(draggedId, hint.id, hint.place);
    }
  };

  const renderedPrefabSpanKeys = new Set<string>();

  return (
    <aside className={`${styles.sidePanel} ${styles.layersPanel}`}>
      <div className={styles.panelHead}>
        <div className={styles.panelHeadMain}>
          <h2 className={styles.panelTitle}>Layers</h2>
          <span className={styles.panelBadge}>{records.length}</span>
        </div>
        {onClearAll ? (
          <button
            type="button"
            className={styles.panelClearBtn}
            disabled={records.length === 0}
            title="Remove all layers from the board"
            onClick={onClearAll}
          >
            Clear all
          </button>
        ) : null}
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
        <p className={styles.layerDragHint}>
          Drag the handle to change draw order
        </p>
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
        <ul ref={listRef} className={styles.layerList}>
          {filtered.map((record) => {
            const line = recordSourceLine(record);
            const span =
              line == null
                ? undefined
                : prefabSpans.find(
                    (candidate) =>
                      line >= candidate.startLine && line <= candidate.endLine,
                  );
            const spanKey = span
              ? `${span.prefabId}:${span.startLine}:${span.endLine}`
              : null;
            const showGroupHeader =
              span != null &&
              spanKey != null &&
              !renderedPrefabSpanKeys.has(spanKey);
            if (spanKey) renderedPrefabSpanKeys.add(spanKey);
            const spanRecordIds = span
              ? (spanRecordIdsByKey.get(`${span.startLine}:${span.endLine}`) ??
                [])
              : [];
            const selected = selectedSet.has(record.id);
            const meta = catalogForDrawKind(record.kind);
            const isDragging = draggingId === record.id;
            const hint =
              dropHint?.id === record.id && draggingId !== record.id
                ? dropHint.place
                : null;
            return (
              <Fragment key={record.id}>
                {span && showGroupHeader ? (
                  <li className={styles.layerGroupHeader}>
                    <span>
                      {getPrefabSection(span.prefabId)?.shortLabel ??
                        span.prefabId}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectMany?.(spanRecordIds, false)}
                    >
                      Select
                    </button>
                  </li>
                ) : null}
                <li
                  data-layer-id={record.id}
                  className={[
                    styles.layerItem,
                    selected ? styles.layerItemSelected : "",
                    isDragging ? styles.layerItemDragging : "",
                    hint === "before" ? styles.layerItemDropBefore : "",
                    hint === "after" ? styles.layerItemDropAfter : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {canDragReorder ? (
                    <button
                      type="button"
                      className={styles.layerDragHandle}
                      title="Drag to reorder"
                      aria-label={`Reorder ${recordLayerLabel(record)}`}
                      onPointerDown={(e) => onHandlePointerDown(e, record.id)}
                      onPointerMove={onHandlePointerMove}
                      onPointerUp={onHandlePointerUp}
                      onPointerCancel={clearDrag}
                    >
                      ⋮⋮
                    </button>
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
              </Fragment>
            );
          })}
        </ul>
      )}
    </aside>
  );
});
