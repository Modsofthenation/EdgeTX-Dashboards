"use client";

import type { ResizeHandle } from "@widget-gen/editor-core";
import { RESIZE_HANDLES, handlePosition } from "@widget-gen/editor-core";
import type { BoundingBox } from "@widget-gen/editor-core";
import styles from "../editor.module.css";

interface TransformHandlesProps {
  box: BoundingBox;
  scale: number;
  offsetX: number;
  offsetY: number;
  onResizeStart: (handle: ResizeHandle, event: React.PointerEvent) => void;
  resizable: boolean;
}

export function TransformHandles({
  box,
  scale,
  offsetX,
  offsetY,
  onResizeStart,
  resizable,
}: TransformHandlesProps) {
  if (!resizable) return null;

  return (
    <>
      {RESIZE_HANDLES.map((handle) => {
        const pos = handlePosition(box, handle);
        const left = offsetX + pos.x * scale;
        const top = offsetY + pos.y * scale;
        return (
          <div
            key={handle}
            className={styles.resizeHandle}
            style={{ left, top }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onResizeStart(handle, e);
            }}
          />
        );
      })}
    </>
  );
}
