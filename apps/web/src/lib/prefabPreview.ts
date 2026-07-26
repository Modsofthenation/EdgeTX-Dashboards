/** Public PNG paths for Layout Insert → prefab section previews. */

export function prefabPreviewSrc(prefabId: string): string {
  return `/prefabs/${prefabId}.png`;
}

/** Full-board Insert action thumbs (assembled prefab composites). */
export function prefabBoardPreviewSrc(boardId: string): string {
  return `/prefabs/boards/${boardId}.png`;
}
