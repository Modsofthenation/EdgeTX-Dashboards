"use client";

import { useCallback, useRef } from "react";
import {
  bboxForElement,
  hitTestElements,
  resizeRectElement,
  snapToGrid,
  translateElement,
  type BoundingBox,
  type EditorElement,
  type ResizeHandle,
} from "@widget-gen/editor-core";
import { TransformHandles } from "./TransformHandles";
import styles from "../editor.module.css";

export interface CanvasLayout {
  scale: number;
  offsetX: number;
  offsetY: number;
  drawW: number;
  drawH: number;
  zoneW: number;
  zoneH: number;
}

interface SelectionOverlayProps {
  elements: EditorElement[];
  selectedIds: string[];
  layout: CanvasLayout | null;
  frameRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (ids: string[]) => void;
  onElementsChange: (updater: (elements: EditorElement[]) => EditorElement[]) => void;
  onInteractionEnd?: () => void;
}

function screenToZone(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  layout: CanvasLayout
): { x: number; y: number } {
  const localX = clientX - rect.left - layout.offsetX;
  const localY = clientY - rect.top - layout.offsetY;
  return {
    x: localX / layout.scale,
    y: localY / layout.scale,
  };
}

function isRectLike(el: EditorElement): boolean {
  return el.kind === "filledRect" || el.kind === "rect" || el.kind === "gauge";
}

export function SelectionOverlay({
  elements,
  selectedIds,
  layout,
  frameRef,
  onSelect,
  onElementsChange,
  onInteractionEnd,
}: SelectionOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    mode: "move" | "resize";
    handle?: ResizeHandle;
    startX: number;
    startY: number;
    startBox?: BoundingBox;
    elementIds: string[];
    shiftKey: boolean;
  } | null>(null);

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (!layout || !frameRef.current) return;
      const rect = frameRef.current.getBoundingClientRect();
      const zone = screenToZone(event.clientX, event.clientY, rect, layout);
      const hitId = hitTestElements(elements, zone.x, zone.y, layout.zoneW, layout.zoneH);

      if (hitId) {
        const additive = event.shiftKey;
        const nextIds = additive
          ? selectedIds.includes(hitId)
            ? selectedIds.filter((id) => id !== hitId)
            : [...selectedIds, hitId]
          : selectedIds.includes(hitId)
            ? selectedIds
            : [hitId];
        onSelect(nextIds);

        dragRef.current = {
          mode: "move",
          startX: zone.x,
          startY: zone.y,
          elementIds: nextIds,
          shiftKey: event.shiftKey,
        };
        (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
        return;
      }

      if (!event.shiftKey) onSelect([]);
    },
    [elements, layout, onSelect, selectedIds, frameRef]
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || !layout || !frameRef.current) return;
      const rect = frameRef.current.getBoundingClientRect();
      const zone = screenToZone(event.clientX, event.clientY, rect, layout);
      const snap = !drag.shiftKey;

      if (drag.mode === "move") {
        const rawDx = zone.x - drag.startX;
        const rawDy = zone.y - drag.startY;
        if (Math.abs(rawDx) < 0.5 && Math.abs(rawDy) < 0.5) return;

        const sdx = snap ? snapToGrid(rawDx, 12, true) : Math.round(rawDx);
        const sdy = snap ? snapToGrid(rawDy, 12, true) : Math.round(rawDy);
        if (sdx === 0 && sdy === 0) return;

        onElementsChange((els) =>
          els.map((el) =>
            drag.elementIds.includes(el.id) ? translateElement(el, sdx, sdy) : el
          )
        );
        drag.startX += sdx;
        drag.startY += sdy;
        return;
      }

      if (drag.mode === "resize" && drag.handle && drag.startBox && drag.elementIds.length === 1) {
        const id = drag.elementIds[0]!;
        const box = { ...drag.startBox };
        const handle = drag.handle;

        if (handle.includes("e")) box.w = Math.max(4, zone.x - box.x);
        if (handle.includes("s")) box.h = Math.max(4, zone.y - box.y);
        if (handle.includes("w")) {
          box.w = Math.max(4, box.x + box.w - zone.x);
          box.x = zone.x;
        }
        if (handle.includes("n")) {
          box.h = Math.max(4, box.y + box.h - zone.y);
          box.y = zone.y;
        }

        if (snap) {
          box.x = snapToGrid(box.x);
          box.y = snapToGrid(box.y);
          box.w = snapToGrid(box.w);
          box.h = snapToGrid(box.h);
        }

        onElementsChange((els) =>
          els.map((el) =>
            el.id === id ? resizeRectElement(el, box, handle) : el
          )
        );
      }
    },
    [layout, onElementsChange, frameRef]
  );

  const onPointerUp = useCallback(() => {
    const wasDragging = dragRef.current !== null;
    dragRef.current = null;
    if (wasDragging) onInteractionEnd?.();
  }, [onInteractionEnd]);

  const onResizeStart = useCallback(
    (handle: ResizeHandle, event: React.PointerEvent, el: EditorElement) => {
      if (!layout) return;
      const box = bboxForElement(el, layout.zoneW, layout.zoneH);
      if (!box) return;
      dragRef.current = {
        mode: "resize",
        handle,
        startX: 0,
        startY: 0,
        startBox: box,
        elementIds: [el.id],
        shiftKey: event.shiftKey,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [layout]
  );

  if (!layout) return null;

  const { scale, offsetX, offsetY, zoneW, zoneH } = layout;

  return (
    <div
      ref={overlayRef}
      className={styles.selectionOverlay}
      style={{ width: "100%", height: "100%" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {elements.map((el) => {
        if (!el.visible) return null;
        const box = bboxForElement(el, zoneW, zoneH);
        if (!box) return null;
        const selected = selectedIds.includes(el.id);
        const left = offsetX + box.x * scale;
        const top = offsetY + box.y * scale;
        const width = box.w * scale;
        const height = box.h * scale;

        return (
          <div key={el.id}>
            <div
              className={`${styles.selectionBox} ${selected ? styles.selectionBoxActive : ""}`}
              style={{ left, top, width, height }}
            />
            {selected && isRectLike(el) && (
              <TransformHandles
                box={box}
                scale={scale}
                offsetX={offsetX}
                offsetY={offsetY}
                resizable
                onResizeStart={(handle, e) => onResizeStart(handle, e, el)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
