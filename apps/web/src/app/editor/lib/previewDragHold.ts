/**
 * Live-drag keep-alive helpers for approximate (non-radio) editor preview.
 *
 * Overlay clears liveDrag as soon as records include the committed geometry
 * (avoids double-applying to selection handles). The approximate canvas may
 * still be painting stale worker commands, so it keeps a hold transform until
 * the preview interpret is no longer pending.
 */

import type { LiveDragState } from "@widget-gen/editor-core";

/** Canvas uses active gesture, else a post-commit hold while interpret is pending. */
export function resolveCanvasLiveDrag(input: {
  liveDrag: LiveDragState | null;
  previewDragHold: LiveDragState | null;
  showParserPreview: boolean;
  previewPending: boolean;
}): LiveDragState | null {
  if (input.liveDrag) return input.liveDrag;
  if (input.showParserPreview && input.previewPending) {
    return input.previewDragHold;
  }
  return null;
}
