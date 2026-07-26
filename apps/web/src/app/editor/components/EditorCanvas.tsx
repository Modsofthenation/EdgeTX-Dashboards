"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getSimulateLayoutProfile,
  resolvePreviewDimensions,
} from "@widget-gen/shared";
import type {
  DocumentRecord,
  ZoneOffset,
  BoundingBox,
  SnapGuide,
  LiveDragState,
} from "@widget-gen/editor-core";
import type { LayoutScenario } from "@widget-gen/layout-verify";
import { computeCanvasLayout, type CanvasLayout } from "../lib/canvasLayout";
import { EditorPreviewCanvas } from "./EditorPreviewCanvas";
import { RecordSelectionOverlay } from "./RecordSelectionOverlay";
import styles from "../editor.module.css";

interface EditorCanvasProps {
  source: string;
  records: DocumentRecord[];
  zone: ZoneOffset;
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onTranslate: (ids: string[], dx: number, dy: number) => void;
  onResize: (id: string, box: BoundingBox) => void;
  onGestureStart?: () => void;
  onGestureEnd?: () => void;
  /** Paint snap guide lines / grid. */
  showSnapGuides?: boolean;
  /** Snap geometry while dragging (independent of guide visibility). */
  snapEnabled?: boolean;
  scenarioId?: string;
  scenarioOverride?: LayoutScenario;
  layoutProfileId?: string;
  /** Optional WASM preview layered under the parser canvas. */
  inlineSim?: React.ReactNode;
  onContextMenu?: (info: {
    clientX: number;
    clientY: number;
    hitId: string | null;
  }) => void;
}

export function EditorCanvas({
  source,
  records,
  zone,
  selectedIds,
  onSelect,
  onTranslate,
  onResize,
  onGestureStart,
  onGestureEnd,
  showSnapGuides = false,
  snapEnabled = true,
  scenarioId = "editor-preview",
  scenarioOverride,
  layoutProfileId = "tx15",
  inlineSim = null,
  onContextMenu,
}: EditorCanvasProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<CanvasLayout | null>(null);
  const [activeGuides, setActiveGuides] = useState<SnapGuide[]>([]);
  const [liveDrag, setLiveDrag] = useState<LiveDragState | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const spaceDownRef = useRef(false);
  const panDragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  useEffect(() => {
    setLiveDrag(null);
  }, [source]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceDownRef.current = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceDownRef.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const previewDims = useMemo(() => {
    try {
      return resolvePreviewDimensions(
        source,
        getSimulateLayoutProfile(layoutProfileId),
      );
    } catch {
      return resolvePreviewDimensions(
        "",
        getSimulateLayoutProfile(layoutProfileId),
      );
    }
  }, [source, layoutProfileId]);

  const updateLayout = useCallback(() => {
    const frame = frameRef.current;
    if (!frame) return;
    setLayout(
      computeCanvasLayout(
        frame.clientWidth,
        frame.clientHeight,
        previewDims.zoneW,
        previewDims.zoneH,
        { zoom, panX: pan.x, panY: pan.y },
      ),
    );
  }, [previewDims.zoneH, previewDims.zoneW, zoom, pan.x, pan.y]);

  useEffect(() => {
    updateLayout();
    const frame = frameRef.current;
    if (!frame || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => updateLayout());
    ro.observe(frame);
    return () => ro.disconnect();
  }, [updateLayout]);

  const onWheel = useCallback(
    (event: React.WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
      setZoom((z) => Math.min(4, Math.max(0.25, Number((z * factor).toFixed(3)))));
    },
    [],
  );

  const onPointerDownPan = useCallback(
    (event: React.PointerEvent) => {
      if (!(event.button === 1 || spaceDownRef.current)) return;
      event.preventDefault();
      panDragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        originX: pan.x,
        originY: pan.y,
      };
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    },
    [pan.x, pan.y],
  );

  const onPointerMovePan = useCallback((event: React.PointerEvent) => {
    const drag = panDragRef.current;
    if (!drag) return;
    setPan({
      x: drag.originX + (event.clientX - drag.startX),
      y: drag.originY + (event.clientY - drag.startY),
    });
  }, []);

  const onPointerUpPan = useCallback(() => {
    panDragRef.current = null;
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  return (
    <div className={styles.canvasStage}>
      <div
        className={styles.simWrapper}
        ref={frameRef}
        onWheel={onWheel}
        onPointerDown={onPointerDownPan}
        onPointerMove={onPointerMovePan}
        onPointerUp={onPointerUpPan}
        onPointerCancel={onPointerUpPan}
      >
        {inlineSim}
        {!inlineSim && (
          <EditorPreviewCanvas
            source={source}
            zone={zone}
            layout={layout}
            scenarioId={scenarioId}
            scenarioOverride={scenarioOverride}
            liveDrag={liveDrag}
          />
        )}
        {showSnapGuides && layout ? (
          <div
            className={styles.snapGrid}
            style={{
              left: layout.offsetX,
              top: layout.offsetY,
              width: layout.drawW,
              height: layout.drawH,
              backgroundSize: `${12 * layout.scale}px ${12 * layout.scale}px`,
            }}
            aria-hidden
          />
        ) : null}
        {showSnapGuides && layout
          ? activeGuides.map((guide) => (
              <div
                key={`${guide.orientation}-${guide.pos}`}
                className={
                  guide.orientation === "v"
                    ? styles.snapGuideV
                    : styles.snapGuideH
                }
                style={
                  guide.orientation === "v"
                    ? {
                        left: layout.offsetX + guide.pos * layout.scale,
                        top: layout.offsetY,
                        height: layout.drawH,
                      }
                    : {
                        top: layout.offsetY + guide.pos * layout.scale,
                        left: layout.offsetX,
                        width: layout.drawW,
                      }
                }
                aria-hidden
              />
            ))
          : null}
        <RecordSelectionOverlay
          records={records}
          selectedIds={selectedIds}
          layout={layout}
          zone={zone}
          frameRef={frameRef}
          onSelect={onSelect}
          onTranslate={onTranslate}
          onResize={onResize}
          onGestureStart={onGestureStart}
          onGestureEnd={onGestureEnd}
          onLiveDragChange={setLiveDrag}
          snapEnabled={snapEnabled}
          onSnapGuidesChange={setActiveGuides}
          onContextMenu={onContextMenu}
        />
      </div>
      <div className={styles.canvasMeta}>
        <span>
          {previewDims.zoneW} × {previewDims.zoneH}
        </span>
        <span className={styles.canvasHint}>·</span>
        <span>
          {previewDims.layout} z{previewDims.zone}
        </span>
        <span className={styles.canvasHint}>·</span>
        <button
          type="button"
          className={styles.canvasHint}
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: "inherit",
            font: "inherit",
          }}
          onClick={resetView}
          title="Reset zoom/pan"
        >
          {Math.round(zoom * 100)}%
        </button>
        <span className={styles.canvasHint}>·</span>
        <span className={styles.canvasHint}>
          Ctrl+wheel zoom · Space-drag pan · Shift+click multi · drag empty to
          marquee
        </span>
      </div>
    </div>
  );
}
