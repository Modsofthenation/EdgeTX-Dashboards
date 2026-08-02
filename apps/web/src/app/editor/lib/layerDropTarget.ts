export type LayerDropRect = {
  id: string;
  top: number;
  bottom: number;
  mid: number;
};

export type LayerDropHint = { id: string; place: "before" | "after" };

/** Resolve drop target from cached row geometry (no DOM reads). */
export function resolveLayerDropTarget(
  clientY: number,
  rows: readonly LayerDropRect[],
  draggedId: string,
): LayerDropHint | null {
  for (const row of rows) {
    if (row.id === draggedId) continue;
    if (clientY < row.top || clientY > row.bottom) continue;
    return {
      id: row.id,
      place: clientY < row.mid ? "before" : "after",
    };
  }
  return null;
}

export function sameLayerDropHint(
  a: LayerDropHint | null,
  b: LayerDropHint | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.id === b.id && a.place === b.place;
}

/** Snapshot `[data-layer-id]` row rectangles once at drag start. */
export function cacheLayerDropRects(list: HTMLElement): LayerDropRect[] {
  const items = list.querySelectorAll<HTMLElement>("[data-layer-id]");
  const rows: LayerDropRect[] = [];
  for (const el of items) {
    const id = el.dataset.layerId;
    if (!id) continue;
    const rect = el.getBoundingClientRect();
    rows.push({
      id,
      top: rect.top,
      bottom: rect.bottom,
      mid: rect.top + rect.height / 2,
    });
  }
  return rows;
}
