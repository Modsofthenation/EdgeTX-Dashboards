"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSimulateLayoutProfile, resolvePreviewDimensions } from "@widget-gen/shared";
import { EditorSimPreview } from "./EditorSimPreview";
import { SelectionOverlay, type CanvasLayout } from "./SelectionOverlay";
import type { EditorElement } from "@widget-gen/editor-core";
import styles from "../editor.module.css";

interface EditorCanvasProps {
  luaSource: string;
  simReady?: boolean;
  simFlushNonce: number;
  elements: EditorElement[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onElementsChange: (updater: (elements: EditorElement[]) => EditorElement[]) => void;
  onInteractionEnd?: () => void;
}

export function EditorCanvas({
  luaSource,
  simReady = true,
  simFlushNonce,
  elements,
  selectedIds,
  onSelect,
  onElementsChange,
  onInteractionEnd,
}: EditorCanvasProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<CanvasLayout | null>(null);

  const previewDims = useMemo(() => {
    try {
      return resolvePreviewDimensions(luaSource, getSimulateLayoutProfile("tx15"));
    } catch {
      return resolvePreviewDimensions(luaSource, getSimulateLayoutProfile("tx15"));
    }
  }, [luaSource]);

  const updateLayout = useCallback(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const cw = frame.clientWidth;
    const ch = frame.clientHeight;
    const zoneW = previewDims.zoneW;
    const zoneH = previewDims.zoneH;
    const scale = Math.min(cw / zoneW, ch / zoneH, 1);
    const drawW = zoneW * scale;
    const drawH = zoneH * scale;
    const offsetX = (cw - drawW) / 2;
    const offsetY = (ch - drawH) / 2;
    setLayout({ scale, offsetX, offsetY, drawW, drawH, zoneW, zoneH });
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
    <div className={styles.canvasStage} ref={stageRef}>
      <div className={styles.simWrapper} ref={frameRef}>
        <EditorSimPreview luaSource={luaSource} simReady={simReady} flushNonce={simFlushNonce} />
        <SelectionOverlay
          elements={elements}
          selectedIds={selectedIds}
          layout={layout}
          frameRef={frameRef}
          onSelect={onSelect}
          onElementsChange={onElementsChange}
          onInteractionEnd={onInteractionEnd}
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
        <span className={styles.canvasHint}>Shift+click multi-select · 12px snap</span>
      </div>
    </div>
  );
}
