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
/** Minimum middle (canvas) column so the preview is not crushed. */
export const CANVAS_MIN = 280;

type PanelWidths = { left: number; right: number };
type DragSide = "left" | "right";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Clamp panel widths so the canvas column stays ≥ CANVAS_MIN when bodyWidth is known. */
export function clampPanelWidths(
  widths: PanelWidths,
  bodyWidth: number | null,
): PanelWidths {
  let left = clamp(widths.left, LEFT_MIN, LEFT_MAX);
  let right = clamp(widths.right, RIGHT_MIN, RIGHT_MAX);
  if (bodyWidth == null || bodyWidth <= 0) {
    return { left, right };
  }
  const fixed = 2 * HANDLE;
  const maxPanels = Math.max(0, bodyWidth - fixed - CANVAS_MIN);
  if (left + right <= maxPanels) {
    return { left, right };
  }
  // Prefer shrinking the larger panel first, then the other, without
  // going below panel mins when possible.
  let overflow = left + right - maxPanels;
  const shrinkLeft = Math.min(overflow, Math.max(0, left - LEFT_MIN));
  left -= shrinkLeft;
  overflow -= shrinkLeft;
  if (overflow > 0) {
    const shrinkRight = Math.min(overflow, Math.max(0, right - RIGHT_MIN));
    right -= shrinkRight;
    overflow -= shrinkRight;
  }
  // If still over (narrow viewport), allow canvas underfloor only after mins.
  if (overflow > 0 && left + right > maxPanels) {
    // Nothing else to give without breaking panel mins.
  }
  return { left, right };
}

function maxForSide(
  side: DragSide,
  other: number,
  bodyWidth: number | null,
): number {
  const panelMax = side === "left" ? LEFT_MAX : RIGHT_MAX;
  if (bodyWidth == null || bodyWidth <= 0) return panelMax;
  const maxAllowed = bodyWidth - other - 2 * HANDLE - CANVAS_MIN;
  return Math.max(
    side === "left" ? LEFT_MIN : RIGHT_MIN,
    Math.min(panelMax, maxAllowed),
  );
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
 * Canvas column is `minmax(CANVAS_MIN, 1fr)` and panels clamp so leftover ≥ CANVAS_MIN.
 */
export function useResizableEditorPanels(
  bodyRef?: React.RefObject<HTMLElement | null>,
) {
  const [widths, setWidths] = useState<PanelWidths>({
    left: LEFT_DEFAULT,
    right: RIGHT_DEFAULT,
  });
  const [hydrated, setHydrated] = useState(false);
  const [activeSide, setActiveSide] = useState<DragSide | null>(null);
  const [bodyWidth, setBodyWidth] = useState<number | null>(null);
  const dragRef = useRef<{
    side: DragSide;
    startX: number;
    origin: number;
  } | null>(null);
  const widthsRef = useRef(widths);
  widthsRef.current = widths;
  const bodyWidthRef = useRef(bodyWidth);
  bodyWidthRef.current = bodyWidth;
  const detachRef = useRef<(() => void) | null>(null);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bodyElRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setWidths(readStored());
    setHydrated(true);
  }, []);

  useEffect(() => {
    const el = bodyRef?.current;
    bodyElRef.current = el ?? null;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (typeof w === "number" && w > 0) {
        setBodyWidth(w);
      }
    });
    ro.observe(el);
    setBodyWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [bodyRef]);

  useEffect(() => {
    if (!hydrated || bodyWidth == null) return;
    setWidths((w) => {
      const next = clampPanelWidths(w, bodyWidth);
      return next.left === w.left && next.right === w.right ? w : next;
    });
  }, [bodyWidth, hydrated]);

  const schedulePersist = useCallback((next: PanelWidths) => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null;
      writeStored(next);
    }, 200);
  }, []);

  useEffect(() => {
    return () => {
      detachRef.current?.();
      detachRef.current = null;
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, []);

  const applyWidthsLive = useCallback(
    (next: PanelWidths) => {
      widthsRef.current = next;
      const el = bodyElRef.current ?? bodyRef?.current;
      if (el) {
        el.style.gridTemplateColumns = `${next.left}px ${HANDLE}px minmax(${CANVAS_MIN}px, 1fr) ${HANDLE}px ${next.right}px`;
      }
    },
    [bodyRef],
  );

  const onHandlePointerDown = useCallback(
    (side: DragSide, event: React.PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();

      detachRef.current?.();

      const current = widthsRef.current;
      dragRef.current = {
        side,
        startX: event.clientX,
        origin: side === "left" ? current.left : current.right,
      };
      setActiveSide(side);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMove = (moveEvent: PointerEvent) => {
        const drag = dragRef.current;
        if (!drag) return;
        const dx = moveEvent.clientX - drag.startX;
        const bw = bodyWidthRef.current;
        const other =
          drag.side === "left"
            ? widthsRef.current.right
            : widthsRef.current.left;
        if (drag.side === "left") {
          const nextLeft = clamp(
            drag.origin + dx,
            LEFT_MIN,
            maxForSide("left", other, bw),
          );
          if (nextLeft === widthsRef.current.left) return;
          applyWidthsLive({ ...widthsRef.current, left: nextLeft });
        } else {
          const nextRight = clamp(
            drag.origin - dx,
            RIGHT_MIN,
            maxForSide("right", other, bw),
          );
          if (nextRight === widthsRef.current.right) return;
          applyWidthsLive({ ...widthsRef.current, right: nextRight });
        }
      };

      const endDrag = () => {
        dragRef.current = null;
        setActiveSide(null);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        // Commit React state once so memoized children update after the drag.
        setWidths({ ...widthsRef.current });
        schedulePersist(widthsRef.current);
        detachRef.current?.();
        detachRef.current = null;
      };

      // Attach synchronously so fast drags aren't lost waiting for useEffect.
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", endDrag);
      window.addEventListener("pointercancel", endDrag);
      detachRef.current = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", endDrag);
        window.removeEventListener("pointercancel", endDrag);
      };
    },
    [applyWidthsLive, schedulePersist],
  );

  const resetWidths = useCallback(() => {
    const next = clampPanelWidths(
      { left: LEFT_DEFAULT, right: RIGHT_DEFAULT },
      bodyWidthRef.current,
    );
    setWidths(next);
    applyWidthsLive(next);
    schedulePersist(next);
  }, [applyWidthsLive, schedulePersist]);

  const gridTemplateColumns = `${widths.left}px ${HANDLE}px minmax(${CANVAS_MIN}px, 1fr) ${HANDLE}px ${widths.right}px`;

  return {
    widths,
    activeSide,
    gridTemplateColumns,
    handleWidth: HANDLE,
    canvasMin: CANVAS_MIN,
    onHandlePointerDown,
    resetWidths,
  };
}
