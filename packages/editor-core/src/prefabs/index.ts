export type {
  PrefabBounds,
  PrefabCatalogEntry,
  PrefabCategory,
  PrefabProtocol,
  PrefabSection,
} from "./types.ts";
export {
  ROTORFLIGHT_HELI_PREFABS,
  listRotorflightHeliPrefabIds,
} from "./rotorflightSections.ts";
export {
  formatPrefabCatalogForPrompt,
  getPrefabSection,
  listPrefabCatalog,
  listPrefabSections,
} from "./registry.ts";
export {
  insertPrefabSection,
  insertPrefabSections,
  ROTORFLIGHT_ELECTRIC_LAYOUT_ORDER,
  ROTORFLIGHT_NITRO_LAYOUT_ORDER,
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
