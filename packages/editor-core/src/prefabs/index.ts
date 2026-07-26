export type {
  PrefabBounds,
  PrefabCatalogEntry,
  PrefabCategory,
  PrefabProtocol,
  PrefabSection,
} from "./types.ts";
export {
  STACYDASH_ROTORFLIGHT_PREFABS,
  listStacyDashPrefabIds,
} from "./stacyDashSections.ts";
export {
  formatPrefabCatalogForPrompt,
  getPrefabSection,
  listPrefabCatalog,
  listPrefabSections,
} from "./registry.ts";
export {
  insertPrefabSection,
  insertPrefabSections,
  STACYDASH_TX15_LAYOUT_ORDER,
  STACYDASH_NITRO_LAYOUT_ORDER,
  type InsertPrefabResult,
} from "./insertPrefab.ts";
export {
  getPrefabSensorSlotsForId,
  listPrefabSpans,
  prefabIdForSourceLine,
  resolvePrefabSensorSlots,
  type PrefabSensorSlot,
  type PrefabSourceSpan,
} from "./prefabContext.ts";
