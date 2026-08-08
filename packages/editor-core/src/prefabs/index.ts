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
  BETAFLIGHT_QUAD_PREFABS,
  DENSE_CRSF_LAYOUT_ORDER,
  FREESTYLE_LAYOUT_ORDER,
  MINIMAL_QUAD_LAYOUT_ORDER,
  WHOOP_LAYOUT_ORDER,
  listBetaflightQuadPrefabIds,
} from "./betaflightQuadSections.ts";
export {
  formatPrefabBoardRecipesForPrompt,
  formatPrefabCatalogForPrompt,
  getPrefabSection,
  listPrefabCatalog,
  listPrefabSections,
  ROTORFLIGHT_ELECTRIC_LAYOUT_ORDER,
  ROTORFLIGHT_NITRO_LAYOUT_ORDER,
} from "./registry.ts";
export {
  createPrefabShellSource,
  insertPrefabSection,
  insertPrefabSections,
  type InsertPrefabResult,
  type PrefabInsertOptions,
} from "./insertPrefab.ts";
export { scaleLcdCoordsInLine, scalePrefabSection } from "./scalePrefab.ts";
export {
  getPrefabSensorSlotsForId,
  listPrefabSpans,
  prefabIdForSourceLine,
  resolvePrefabSensorSlots,
  type PrefabSensorSlot,
  type PrefabSourceSpan,
} from "./prefabContext.ts";
