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
  showSnapGuides?: boolean;
  scenarioId?: string;
  scenarioOverride?: LayoutScenario;
  layoutProfileId?: string;
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
  scenarioId = "editor-preview",
  scenarioOverride,
  layoutProfileId = "tx15",
  onContextMenu,
}: EditorCanvasProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<CanvasLayout | null>(null);
  const [activeGuides, setActiveGuides] = useState<SnapGuide[]>([]);
  const [liveDrag, setLiveDrag] = useState<LiveDragState | null>(null);

  // Drop live overlay once Lua source catches up after pointerup commit.
  useEffect(() => {
    setLiveDrag(null);
  }, [source]);

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
      ),
    );
  }, [previewDims.zoneH, previewDims.zoneW]);

  useEffect(() => {
    updateLayout();
    const frame = frameRef.current;
    if (!frame || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => updateLayout());
    ro.observe(frame);
    return () => ro.disconnect();
  }, [updateLayout]);

  return (
    <div className={styles.canvasStage}>
      <div className={styles.simWrapper} ref={frameRef}>
        <EditorPreviewCanvas
          source={source}
          zone={zone}
          layout={layout}
          scenarioId={scenarioId}
          scenarioOverride={scenarioOverride}
          liveDrag={liveDrag}
        />
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
          snapEnabled={showSnapGuides}
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
        <span className={styles.canvasHint}>
          Canvas preview · Right-click for actions · Shift/Ctrl+click multi-select
        </span>
      </div>
    </div>
  );
}
