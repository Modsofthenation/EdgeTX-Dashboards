"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "edgetx.editor.panelWidths.v1";
const LEFT_DEFAULT = 240;
const RIGHT_DEFAULT = 280;
const LEFT_MIN = 160;
const LEFT_MAX = 420;
const RIGHT_MIN = 180;
const RIGHT_MAX = 480;
/** Visual + grid column width for each resize gutter. */
const HANDLE = 12;

type PanelWidths = { left: number; right: number };
type DragSide = "left" | "right";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function readStored(): PanelWidths {
  if (typeof window === "undefined") {
    return { left: LEFT_DEFAULT, right: RIGHT_DEFAULT };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { left: LEFT_DEFAULT, right: RIGHT_DEFAULT };
    const parsed = JSON.parse(raw) as Partial<PanelWidths>;
    return {
      left: clamp(Number(parsed.left) || LEFT_DEFAULT, LEFT_MIN, LEFT_MAX),
      right: clamp(Number(parsed.right) || RIGHT_DEFAULT, RIGHT_MIN, RIGHT_MAX),
    };
  } catch {
    return { left: LEFT_DEFAULT, right: RIGHT_DEFAULT };
  }
}

function writeStored(widths: PanelWidths): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
  } catch {
    /* ignore */
  }
}

/**
 * Desktop editor body columns: left | handle | canvas | handle | right.
 * Widths persist across sessions; mobile layout ignores these.
 * Canvas column is `minmax(0, 1fr)` so it shrinks/grows with the leftover space.
 */
export function useResizableEditorPanels() {
  // Start with defaults so SSR / first paint match; hydrate from storage after mount.
  const [widths, setWidths] = useState<PanelWidths>({
    left: LEFT_DEFAULT,
    right: RIGHT_DEFAULT,
  });
  const [hydrated, setHydrated] = useState(false);
  const [activeSide, setActiveSide] = useState<DragSide | null>(null);
  const dragRef = useRef<{
    side: DragSide;
    startX: number;
    origin: number;
  } | null>(null);
  const widthsRef = useRef(widths);
  widthsRef.current = widths;

  useEffect(() => {
    setWidths(readStored());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeStored(widths);
  }, [widths, hydrated]);

  const endDrag = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setActiveSide(null);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    if (!activeSide) return;

    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = event.clientX - drag.startX;
      if (drag.side === "left") {
        const next = clamp(drag.origin + dx, LEFT_MIN, LEFT_MAX);
        setWidths((w) => (w.left === next ? w : { ...w, left: next }));
      } else {
        // Dragging the right handle: moving left shrinks the right panel.
        const next = clamp(drag.origin - dx, RIGHT_MIN, RIGHT_MAX);
        setWidths((w) => (w.right === next ? w : { ...w, right: next }));
      }
    };

    const onUp = () => endDrag();

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [activeSide, endDrag]);

  const onHandlePointerDown = useCallback(
    (side: DragSide, event: React.PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      const current = widthsRef.current;
      dragRef.current = {
        side,
        startX: event.clientX,
        origin: side === "left" ? current.left : current.right,
      };
      setActiveSide(side);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [],
  );

  const resetWidths = useCallback(() => {
    setWidths({ left: LEFT_DEFAULT, right: RIGHT_DEFAULT });
  }, []);

  const gridTemplateColumns = `${widths.left}px ${HANDLE}px minmax(0, 1fr) ${HANDLE}px ${widths.right}px`;

  return {
    widths,
    activeSide,
    gridTemplateColumns,
    handleWidth: HANDLE,
    onHandlePointerDown,
    resetWidths,
  };
}
