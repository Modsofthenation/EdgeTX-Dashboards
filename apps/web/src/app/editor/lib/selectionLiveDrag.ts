import type { BoundingBox, LiveDragState } from "@widget-gen/editor-core";

/**
 * Apply in-progress drag transform to a selection box derived from records.
 * After Lua commit, liveDrag must be cleared — otherwise move deltas are
 * applied twice (once in record coords, once here).
 */
export function selectionBoxWithLiveDrag(
  id: string,
  box: BoundingBox,
  liveDrag: LiveDragState | null | undefined,
): BoundingBox {
  if (!liveDrag || !liveDrag.ids.includes(id)) return box;
  if (liveDrag.mode === "move") {
    return {
      ...box,
      x: box.x + liveDrag.dx,
      y: box.y + liveDrag.dy,
    };
  }
  if (liveDrag.mode === "resize" && liveDrag.ids[0] === id) {
    return liveDrag.box;
  }
  return box;
}
