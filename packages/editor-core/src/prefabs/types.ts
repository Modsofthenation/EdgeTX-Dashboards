/**
 * Shared dashboard prefab sections — reusable multi-primitive layout blocks
 * for the visual editor and AI generator.
 *
 * Community heli dashboards (often 800×480 LVGL) are adapted here to TX15
 * 480×320 with direct lcd.* calls so web preview / layout-verify can interpret them.
 */

export type PrefabProtocol =
  "rotorflight" | "betaflight" | "generic-crsf" | "any";

export type PrefabCategory =
  "header" | "hero" | "card" | "strip" | "footer" | "panel";

export interface PrefabBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PrefabSection {
  /** Stable id used by editor insert + AI prompts (e.g. rf-headspeed-hero). */
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  /** Origin inspiration / family. */
  family: "rotorflight-heli" | "betaflight-quad";
  protocol: PrefabProtocol;
  category: PrefabCategory;
  /** Sensors that must exist in the protocol catalog for meaningful data. */
  requiredSensors: string[];
  optionalSensors: string[];
  /** User-facing setup callouts (rf2bg, naming quirks, etc.). */
  telemetryNotes: string[];
  /** create() src key → catalog sensor name (defaults; remappable in the editor). */
  createSrcBindings: Record<string, string>;
  /** Optional UI labels for src keys (e.g. hspd → "Headspeed"). */
  srcSlotLabels?: Record<string, string>;
  /**
   * Lines inserted into refresh() (no leading indent).
   * Must use direct lcd.* calls; prefer locals then drawText for preview.
   */
  refreshLines: string[];
  defaultBounds: PrefabBounds;
}

export interface PrefabCatalogEntry {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  category: PrefabCategory;
  protocol: PrefabProtocol;
  requiredSensors: string[];
  telemetryNotes: string[];
}
