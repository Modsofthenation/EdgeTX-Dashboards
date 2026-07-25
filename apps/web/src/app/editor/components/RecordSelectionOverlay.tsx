"use client";

import { useCallback, useRef } from "react";
import {
  bboxForRecordInZone,
  hitTestRecords,
  isRectLike,
  resizeRecordBox,
  snapToGrid,
  type BoundingBox,
  type DocumentRecord,
  type ResizeHandle,
  type ZoneOffset,
} from "@widget-gen/editor-core";
import { TransformHandles } from "./TransformHandles";
import type { CanvasLayout } from "../lib/canvasLayout";
import styles from "../editor.module.css";

interface RecordSelectionOverlayProps {
  records: DocumentRecord[];
  selectedIds: string[];
  layout: CanvasLayout | null;
  zone: ZoneOffset;
  frameRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (ids: string[]) => void;
  onTranslate: (ids: string[], dx: number, dy: number) => void;
  onResize: (id: string, box: BoundingBox) => void;
  onGestureStart?: () => void;
  onGestureEnd?: () => void;
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
}: RecordSelectionOverlayProps) {
  const dragRef = useRef<{
    mode: "move" | "resize";
    handle?: ResizeHandle;
    startX: number;
    startY: number;
    startBox?: BoundingBox;
    recordIds: string[];
    shiftKey: boolean;
    moved: boolean;
  } | null>(null);

  const finishGesture = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    onGestureEnd?.();
  }, [onGestureEnd]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (!layout || !frameRef.current) return;
      const rect = frameRef.current.getBoundingClientRect();
      const pointer = screenToZone(event.clientX, event.clientY, rect, layout);
      const hit = hitTestRecords(records, pointer.x, pointer.y, zone);

      if (hit) {
        const additive = event.shiftKey;
        const nextIds = additive
          ? selectedIds.includes(hit.id!)
            ? selectedIds.filter((id) => id !== hit.id)
            : [...selectedIds, hit.id!]
          : selectedIds.includes(hit.id!)
            ? selectedIds
            : [hit.id!];
        onSelect(nextIds);

        onGestureStart?.();
        dragRef.current = {
          mode: "move",
          startX: pointer.x,
          startY: pointer.y,
          recordIds: nextIds,
          shiftKey: event.shiftKey,
          moved: false,
        };
        (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
        return;
      }

      if (!event.shiftKey) onSelect([]);
    },
    [
      records,
      layout,
      onSelect,
      selectedIds,
      frameRef,
      zone,
      onGestureStart,
    ],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || !layout || !frameRef.current) return;
      const rect = frameRef.current.getBoundingClientRect();
      const pointer = screenToZone(event.clientX, event.clientY, rect, layout);
      const snap = !drag.shiftKey;

      if (drag.mode === "move") {
        const rawDx = pointer.x - drag.startX;
        const rawDy = pointer.y - drag.startY;
        if (Math.abs(rawDx) < 0.5 && Math.abs(rawDy) < 0.5) return;

        const sdx = snap ? snapToGrid(rawDx, 12, true) : Math.round(rawDx);
        const sdy = snap ? snapToGrid(rawDy, 12, true) : Math.round(rawDy);
        if (sdx === 0 && sdy === 0) return;

        onTranslate(drag.recordIds, sdx, sdy);
        drag.startX += sdx;
        drag.startY += sdy;
        drag.moved = true;
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
        onResize(drag.recordIds[0]!, box);
        drag.moved = true;
      }
    },
    [layout, onTranslate, onResize, frameRef],
  );

  const onPointerUp = useCallback(() => {
    finishGesture();
  }, [finishGesture]);

  const onResizeStart = useCallback(
    (
      handle: ResizeHandle,
      event: React.PointerEvent,
      record: DocumentRecord,
    ) => {
      if (!layout) return;
      const box = bboxForRecordInZone(record, zone);
      if (!box) return;
      onGestureStart?.();
      dragRef.current = {
        mode: "resize",
        handle,
        startX: 0,
        startY: 0,
        startBox: box,
        recordIds: [record.id],
        shiftKey: event.shiftKey,
        moved: false,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [layout, zone, onGestureStart],
  );

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
    >
      {records.map((record) => {
        const box = bboxForRecordInZone(record, zone);
        if (!box) return null;
        const selected = selectedIds.includes(record.id);
        const left = offsetX + box.x * scale;
        const top = offsetY + box.y * scale;
        const width = box.w * scale;
        const height = box.h * scale;

        return (
          <div key={record.id}>
            <div
              className={`${styles.selectionBox} ${selected ? styles.selectionBoxActive : ""}`}
              style={{ left, top, width, height }}
            />
            {selected && isRectLike(record) && (
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
