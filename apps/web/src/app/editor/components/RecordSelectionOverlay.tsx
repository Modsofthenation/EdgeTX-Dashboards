"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  bboxForRecordInZone,
  hitTestRecords,
  isRectLike,
  normalizeRect,
  rectsIntersect,
  resizeRecordBox,
  snapDeltaToGuides,
  type BoundingBox,
  type DocumentRecord,
  type LiveDragState,
  type ResizeHandle,
  type SnapGuide,
  type ZoneOffset,
} from "@widget-gen/editor-core";
import { measurePreviewText } from "~/lib/luaPreviewEngine";
import { TransformHandles } from "./TransformHandles";
import type { CanvasLayout } from "../lib/canvasLayout";
import styles from "../editor.module.css";
import { selectionBoxWithLiveDrag } from "../lib/selectionLiveDrag";

interface RecordSelectionOverlayProps {
  records: DocumentRecord[];
  selectedIds: string[];
  layout: CanvasLayout | null;
  zone: ZoneOffset;
  frameRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (ids: string[]) => void;
  /** Commit translate once on pointerup (total delta from gesture start). */
  onTranslate: (ids: string[], dx: number, dy: number) => void;
  /** Commit resize once on pointerup (zone-relative box). */
  onResize: (id: string, box: BoundingBox) => void;
  onGestureStart?: () => void;
  onGestureEnd?: () => void;
  /** Controlled live geometry from EditorCanvas (single owner). */
  liveDrag: LiveDragState | null;
  /** Publish live geometry for preview paint — no Lua rewrite until commit. */
  onLiveDragChange: (live: LiveDragState | null) => void;
  /** When true (default), snap to element/LCD edges then grid. */
  snapEnabled?: boolean;
  onSnapGuidesChange?: (guides: SnapGuide[]) => void;
  onContextMenu?: (info: {
    clientX: number;
    clientY: number;
    hitId: string | null;
  }) => void;
  /**
   * When true, selection still works but drag/resize are disabled
   * (approximate overlay is unreliable — edit in Source or enable radio preview).
   */
  geometryEditsLocked?: boolean;
}

function screenToZone(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  layout: CanvasLayout,
): { x: number; y: number } {
  const localX = clientX - rect.left - layout.offsetX;
  const localY = clientY - rect.top - layout.offsetY;
  return {
    x: localX / layout.scale,
    y: localY / layout.scale,
  };
}

type DragSession = {
  mode: "move" | "resize" | "marquee";
  handle?: ResizeHandle;
  originX: number;
  originY: number;
  startBox?: BoundingBox;
  recordIds: string[];
  shiftKey: boolean;
  moved: boolean;
  dx: number;
  dy: number;
  liveBox?: BoundingBox;
  /** Marquee current corner in zone space. */
  marqueeX?: number;
  marqueeY?: number;
  baseSelectedIds?: string[];
  /** Cached at gesture start for snap (avoids per-move bbox work). */
  movingBoxes?: BoundingBox[];
  otherBoxes?: BoundingBox[];
};

export function RecordSelectionOverlay({
  records,
  selectedIds,
  layout,
  zone,
  frameRef,
  onSelect,
  onTranslate,
  onResize,
  onGestureStart,
  onGestureEnd,
  liveDrag,
  onLiveDragChange,
  snapEnabled = true,
  onSnapGuidesChange,
  onContextMenu,
  geometryEditsLocked = false,
}: RecordSelectionOverlayProps) {
  const dragRef = useRef<DragSession | null>(null);
  const [marquee, setMarquee] = useState<BoundingBox | null>(null);
  const measureCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingLiveRef = useRef<LiveDragState | null>(null);
  const pendingPointerRef = useRef<{
    clientX: number;
    clientY: number;
  } | null>(null);
  const marqueeRafRef = useRef<number | null>(null);

  const measureText = useCallback((text: string, fontSize: number) => {
    if (!measureCtxRef.current) {
      const c = document.createElement("canvas");
      measureCtxRef.current = c.getContext("2d");
    }
    return measurePreviewText(text, fontSize, measureCtxRef.current);
  }, []);

  const baseBoxById = useMemo(() => {
    const map = new Map<string, BoundingBox>();
    for (const record of records) {
      if (!record.id) continue;
      const box = bboxForRecordInZone(record, zone, measureText);
      if (box) map.set(record.id, box);
    }
    return map;
  }, [records, zone, measureText]);

  const publishLive = useCallback(
    (next: LiveDragState | null) => {
      pendingLiveRef.current = next;
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        onLiveDragChange(pendingLiveRef.current);
      });
    },
    [onLiveDragChange],
  );

  const applyPointerSample = useCallback(
    (clientX: number, clientY: number) => {
      const drag = dragRef.current;
      if (!drag || !layout || !frameRef.current) return;
      const rect = frameRef.current.getBoundingClientRect();
      const pointer = screenToZone(clientX, clientY, rect, layout);
      const snap = snapEnabled && !drag.shiftKey;

      if (drag.mode === "move") {
        const rawDx = pointer.x - drag.originX;
        const rawDy = pointer.y - drag.originY;
        if (Math.abs(rawDx) < 0.5 && Math.abs(rawDy) < 0.5 && !drag.moved) {
          return;
        }

        let sdx = Math.round(rawDx);
        let sdy = Math.round(rawDy);
        if (snap) {
          const movingBoxes = drag.movingBoxes ?? [];
          const otherBoxes = drag.otherBoxes ?? [];
          const snapped = snapDeltaToGuides(
            rawDx,
            rawDy,
            movingBoxes,
            otherBoxes,
            { w: zone.zoneW, h: zone.zoneH },
          );
          sdx = snapped.dx;
          sdy = snapped.dy;
          onSnapGuidesChange?.(snapped.guides);
        } else {
          onSnapGuidesChange?.([]);
        }

        drag.dx = sdx;
        drag.dy = sdy;
        drag.moved = true;
        publishLive({
          mode: "move",
          ids: drag.recordIds,
          dx: sdx,
          dy: sdy,
        });
        return;
      }

      if (drag.mode === "marquee") {
        drag.marqueeX = pointer.x;
        drag.marqueeY = pointer.y;
        drag.moved = true;
        setMarquee(
          normalizeRect(drag.originX, drag.originY, pointer.x, pointer.y),
        );
        return;
      }

      if (
        drag.mode === "resize" &&
        drag.handle &&
        drag.startBox &&
        drag.recordIds.length === 1
      ) {
        const box = resizeRecordBox(
          drag.startBox,
          drag.handle,
          pointer.x,
          pointer.y,
          snap,
        );
        drag.liveBox = box;
        drag.moved = true;
        publishLive({
          mode: "resize",
          ids: drag.recordIds,
          box,
        });
      }
    },
    [layout, frameRef, snapEnabled, zone, onSnapGuidesChange, publishLive],
  );

  const finishGesture = useCallback(() => {
    // Flush any coalesced pointer sample before committing.
    const pending = pendingPointerRef.current;
    pendingPointerRef.current = null;
    if (pending && dragRef.current && layout && frameRef.current) {
      applyPointerSample(pending.clientX, pending.clientY);
    }

    const drag = dragRef.current;
    dragRef.current = null;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (marqueeRafRef.current != null) {
      cancelAnimationFrame(marqueeRafRef.current);
      marqueeRafRef.current = null;
    }
    pendingLiveRef.current = null;
    onSnapGuidesChange?.([]);

    let committed = false;
    if (drag?.mode === "marquee") {
      const box = normalizeRect(
        drag.originX,
        drag.originY,
        drag.marqueeX ?? drag.originX,
        drag.marqueeY ?? drag.originY,
      );
      setMarquee(null);
      if (drag.moved && (box.w > 2 || box.h > 2)) {
        const hitIds = records
          .filter((r) => {
            const b = r.id ? baseBoxById.get(r.id) : undefined;
            return b ? rectsIntersect(box, b) : false;
          })
          .map((r) => r.id);
        const next = drag.shiftKey
          ? [...new Set([...(drag.baseSelectedIds ?? []), ...hitIds])]
          : hitIds;
        onSelect(next);
      } else if (!drag.shiftKey) {
        onSelect([]);
      }
      onGestureEnd?.();
      return;
    }

    if (drag?.moved) {
      if (drag.mode === "move" && (drag.dx !== 0 || drag.dy !== 0)) {
        // Keep final live transform painted until parent clears on records update.
        onLiveDragChange({
          mode: "move",
          ids: drag.recordIds,
          dx: drag.dx,
          dy: drag.dy,
        });
        onTranslate(drag.recordIds, drag.dx, drag.dy);
        committed = true;
      } else if (
        drag.mode === "resize" &&
        drag.liveBox &&
        drag.recordIds.length === 1
      ) {
        onLiveDragChange({
          mode: "resize",
          ids: drag.recordIds,
          box: drag.liveBox,
        });
        onResize(drag.recordIds[0]!, drag.liveBox);
        committed = true;
      }
    }

    if (!committed) {
      onLiveDragChange(null);
    }

    onGestureEnd?.();
  }, [
    applyPointerSample,
    baseBoxById,
    frameRef,
    layout,
    onGestureEnd,
    onLiveDragChange,
    onResize,
    onSelect,
    onSnapGuidesChange,
    onTranslate,
    records,
  ]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (!layout || !frameRef.current) return;
      const rect = frameRef.current.getBoundingClientRect();
      const pointer = screenToZone(event.clientX, event.clientY, rect, layout);
      const hit = hitTestRecords(
        records,
        pointer.x,
        pointer.y,
        zone,
        measureText,
      );

      if (hit) {
        const additive = event.shiftKey || event.metaKey || event.ctrlKey;
        const nextIds = additive
          ? selectedIds.includes(hit.id!)
            ? selectedIds.filter((id) => id !== hit.id)
            : [...selectedIds, hit.id!]
          : selectedIds.includes(hit.id!)
            ? selectedIds
            : [hit.id!];
        onSelect(nextIds);

        if (geometryEditsLocked) return;

        onGestureStart?.();
        const idSet = new Set(nextIds);
        const movingBoxes = nextIds
          .map((id) => baseBoxById.get(id))
          .filter((b): b is BoundingBox => Boolean(b));
        const otherBoxes = records
          .filter((r) => r.id && !idSet.has(r.id))
          .map((r) => baseBoxById.get(r.id!))
          .filter((b): b is BoundingBox => Boolean(b));
        dragRef.current = {
          mode: "move",
          originX: pointer.x,
          originY: pointer.y,
          recordIds: nextIds,
          shiftKey: event.shiftKey || event.metaKey || event.ctrlKey,
          moved: false,
          dx: 0,
          dy: 0,
          movingBoxes,
          otherBoxes,
        };
        (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
        return;
      }

      if (!event.shiftKey) onSelect([]);
      if (geometryEditsLocked) return;
      onGestureStart?.();
      dragRef.current = {
        mode: "marquee",
        originX: pointer.x,
        originY: pointer.y,
        marqueeX: pointer.x,
        marqueeY: pointer.y,
        recordIds: [],
        shiftKey: event.shiftKey || event.metaKey || event.ctrlKey,
        moved: false,
        dx: 0,
        dy: 0,
        baseSelectedIds: selectedIds,
      };
      (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    },
    [
      records,
      layout,
      onSelect,
      selectedIds,
      frameRef,
      zone,
      onGestureStart,
      measureText,
      geometryEditsLocked,
      baseBoxById,
    ],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!dragRef.current) return;
      pendingPointerRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
      };
      if (marqueeRafRef.current != null) return;
      marqueeRafRef.current = requestAnimationFrame(() => {
        marqueeRafRef.current = null;
        const pending = pendingPointerRef.current;
        if (!pending) return;
        applyPointerSample(pending.clientX, pending.clientY);
      });
    },
    [applyPointerSample],
  );

  const onPointerUp = useCallback(() => {
    finishGesture();
  }, [finishGesture]);

  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      if (!onContextMenu || !layout || !frameRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = frameRef.current.getBoundingClientRect();
      const pointer = screenToZone(event.clientX, event.clientY, rect, layout);
      const hit = hitTestRecords(
        records,
        pointer.x,
        pointer.y,
        zone,
        measureText,
      );
      onContextMenu({
        clientX: event.clientX,
        clientY: event.clientY,
        hitId: hit?.id ?? null,
      });
    },
    [onContextMenu, layout, frameRef, records, zone, measureText],
  );

  const onResizeStart = useCallback(
    (
      handle: ResizeHandle,
      event: React.PointerEvent,
      record: DocumentRecord,
    ) => {
      if (!layout || geometryEditsLocked) return;
      const box = bboxForRecordInZone(record, zone, measureText);
      if (!box) return;
      onGestureStart?.();
      dragRef.current = {
        mode: "resize",
        handle,
        originX: 0,
        originY: 0,
        startBox: box,
        recordIds: [record.id],
        shiftKey: event.shiftKey,
        moved: false,
        dx: 0,
        dy: 0,
        liveBox: box,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [layout, zone, onGestureStart, measureText, geometryEditsLocked],
  );

  const selectedBoxes = useMemo(() => {
    if (!layout) return [];
    return selectedIds
      .map((id) => {
        const record = records.find((r) => r.id === id);
        if (!record) return null;
        const base = baseBoxById.get(id);
        if (!base) return null;
        const box = selectionBoxWithLiveDrag(id, base, liveDrag);
        return { record, box };
      })
      .filter(
        (
          row,
        ): row is {
          record: DocumentRecord;
          box: BoundingBox;
        } => row != null,
      );
  }, [layout, selectedIds, records, baseBoxById, liveDrag]);

  if (!layout) return null;

  const { scale, offsetX, offsetY } = layout;

  return (
    <div
      className={styles.selectionOverlay}
      style={{ width: "100%", height: "100%" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={handleContextMenu}
    >
      {marquee && (
        <div
          className={styles.marqueeRect}
          style={{
            left: offsetX + marquee.x * scale,
            top: offsetY + marquee.y * scale,
            width: Math.max(1, marquee.w * scale),
            height: Math.max(1, marquee.h * scale),
          }}
        />
      )}
      {selectedBoxes.map(({ record, box }) => {
        const left = offsetX + box.x * scale;
        const top = offsetY + box.y * scale;
        const width = Math.max(1, box.w * scale);
        const height = Math.max(1, box.h * scale);

        return (
          <div key={record.id}>
            <div
              className={`${styles.selectionBox} ${styles.selectionBoxActive}`}
              style={{ left, top, width, height }}
            />
            {isRectLike(record) && !geometryEditsLocked && (
              <TransformHandles
                box={box}
                scale={scale}
                offsetX={offsetX}
                offsetY={offsetY}
                resizable
                onResizeStart={(handle, e) => onResizeStart(handle, e, record)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
