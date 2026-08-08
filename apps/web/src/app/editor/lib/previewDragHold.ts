/**
 * Live-drag keep-alive helpers for approximate (non-radio) editor preview.
 *
 * Overlay clears liveDrag as soon as committed Lua source lands (avoids
 * double-applying to selection handles). The approximate canvas may still be
 * painting stale worker commands, so it keeps a hold transform until the
 * preview interpret's *source* catches up — not while only scenario/profile
 * mocks are pending (those must not re-apply the drag delta).
 */

import type { LiveDragState } from "@widget-gen/editor-core";

/** Canvas uses active gesture, else a post-commit hold while source interpret lags. */
export function resolveCanvasLiveDrag(input: {
  liveDrag: LiveDragState | null;
  previewDragHold: LiveDragState | null;
  showParserPreview: boolean;
  /** Must be source-only pending (not scenario/profile). */
  sourcePending: boolean;
}): LiveDragState | null {
  if (input.liveDrag) return input.liveDrag;
  if (input.showParserPreview && input.sourcePending) {
    return input.previewDragHold;
  }
  return null;
}
