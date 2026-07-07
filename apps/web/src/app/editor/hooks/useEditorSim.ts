"use client";

import { useMemo } from "react";
import { sceneToLua } from "@widget-gen/editor-core";
import type { WidgetScene } from "@widget-gen/editor-core";

/**
 * WASM preview source: original Lua until the user edits, then generated scene Lua.
 */
export function usePreviewLua(
  scene: WidgetScene,
  baselineSource: string | null,
  previewUsesScene: boolean
): string {
  return useMemo(() => {
    if (!previewUsesScene && baselineSource) return baselineSource;
    return sceneToLua(scene);
  }, [previewUsesScene, baselineSource, scene]);
}
