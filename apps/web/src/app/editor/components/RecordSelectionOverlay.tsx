"use client";

import { useCallback, useMemo, useRef } from "react";
import {
  bboxForRecordInZone,
  hitTestRecords,
  isRectLike,
  resizeRecordBox,
  snapDeltaToGuides,
  type BoundingBox,
  type DocumentRecord,
  type ResizeHandle,
  type SnapGuide,
  type ZoneOffset,
} from "@widget-gen/editor-core";
import { measurePreviewText } from "~/lib/luaPreviewEngine";
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
  /** When true (default), snap to element/LCD edges then grid. */
  snapEnabled?: boolean;
  onSnapGuidesChange?: (guides: SnapGuide[]) => void;
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
  snapEnabled = true,
  onSnapGuidesChange,
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
  const measureCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  const measureText = useCallback((text: string, fontSize: number) => {
    if (!measureCtxRef.current) {
      const c = document.createElement("canvas");
      measureCtxRef.current = c.getContext("2d");
    }
    return measurePreviewText(text, fontSize, measureCtxRef.current);
  }, []);

  const finishGesture = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    onSnapGuidesChange?.([]);
    onGestureEnd?.();
  }, [onGestureEnd, onSnapGuidesChange]);

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

        onGestureStart?.();
        dragRef.current = {
          mode: "move",
          startX: pointer.x,
          startY: pointer.y,
          recordIds: nextIds,
          shiftKey: event.shiftKey || event.metaKey || event.ctrlKey,
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
      measureText,
    ],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || !layout || !frameRef.current) return;
      const rect = frameRef.current.getBoundingClientRect();
      const pointer = screenToZone(event.clientX, event.clientY, rect, layout);
      const snap = snapEnabled && !drag.shiftKey;

      if (drag.mode === "move") {
        const rawDx = pointer.x - drag.startX;
        const rawDy = pointer.y - drag.startY;
        if (Math.abs(rawDx) < 0.5 && Math.abs(rawDy) < 0.5) return;

        let sdx = Math.round(rawDx);
        let sdy = Math.round(rawDy);
        if (snap) {
          const movingBoxes = drag.recordIds
            .map((id) => records.find((r) => r.id === id))
            .filter((r): r is DocumentRecord => Boolean(r))
            .map((r) => bboxForRecordInZone(r, zone, measureText))
            .filter((b): b is BoundingBox => Boolean(b));
          const otherBoxes = records
            .filter((r) => !drag.recordIds.includes(r.id!))
            .map((r) => bboxForRecordInZone(r, zone, measureText))
            .filter((b): b is BoundingBox => Boolean(b));
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
    [
      layout,
      onTranslate,
      onResize,
      frameRef,
      snapEnabled,
      records,
      zone,
      measureText,
      onSnapGuidesChange,
    ],
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
      const box = bboxForRecordInZone(record, zone, measureText);
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
    [layout, zone, onGestureStart, measureText],
  );

  const selectedBoxes = useMemo(() => {
    if (!layout) return [];
    return selectedIds
      .map((id) => {
        const record = records.find((r) => r.id === id);
        if (!record) return null;
        const box = bboxForRecordInZone(record, zone, measureText);
        if (!box) return null;
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
  }, [layout, selectedIds, records, zone, measureText]);

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
            {isRectLike(record) && (
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
