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
} from "@widget-gen/editor-core";
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
  showSnapGuides?: boolean;
  scenarioId?: string;
}

export function EditorCanvas({
  source,
  records,
  zone,
  selectedIds,
  onSelect,
  onTranslate,
  onResize,
  showSnapGuides = false,
  scenarioId = "editor-preview",
}: EditorCanvasProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<CanvasLayout | null>(null);

  const previewDims = useMemo(() => {
    try {
      return resolvePreviewDimensions(source, getSimulateLayoutProfile("tx15"));
    } catch {
      return resolvePreviewDimensions("", getSimulateLayoutProfile("tx15"));
    }
  }, [source]);

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
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(updateLayout);
    observer.observe(frame);
    updateLayout();
    return () => observer.disconnect();
  }, [updateLayout]);

  return (
    <div className={styles.canvasStage}>
      <div className={styles.simWrapper} ref={frameRef}>
        <EditorPreviewCanvas
          source={source}
          zone={zone}
          layout={layout}
          scenarioId={scenarioId}
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
        <RecordSelectionOverlay
          records={records}
          selectedIds={selectedIds}
          layout={layout}
          zone={zone}
          frameRef={frameRef}
          onSelect={onSelect}
          onTranslate={onTranslate}
          onResize={onResize}
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
          Canvas preview · Shift+click multi-select
        </span>
      </div>
    </div>
  );
}
