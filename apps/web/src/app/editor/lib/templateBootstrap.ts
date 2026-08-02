/**
 * Resolve gallery template → initial Layout editor Lua (sync, before first paint).
 * Keeps WASM/radio preview from booting on starter then hot-swapping the board.
 */

import {
  createPrefabShellSource,
  getLayoutTemplateBoardSource,
  insertPrefabSections,
  ROTORFLIGHT_ELECTRIC_LAYOUT_ORDER,
  ROTORFLIGHT_NITRO_LAYOUT_ORDER,
  type PrefabInsertOptions,
} from "@widget-gen/editor-core";
import type { TelemetryProtocol } from "@widget-gen/shared";
import {
  getTemplateById,
  type TemplateLayoutPrefab,
} from "~/lib/templateGallery";

export type TemplateCompanionSuite =
  "rf-heli-electric" | "sensor-dump" | "batt-select" | "flight-logger";

export type TemplateEditorBootstrap = {
  source: string;
  protocol: TelemetryProtocol;
  prefab: TemplateLayoutPrefab;
  companionSuites: TemplateCompanionSuite[];
};

export function resolveTemplateEditorBootstrap(
  templateId: string,
  lcd?: PrefabInsertOptions,
): TemplateEditorBootstrap | null {
  const template = getTemplateById(templateId);
  if (!template) return null;
  const prefab: TemplateLayoutPrefab = template.layoutPrefab ?? "starter";
  const companionSuites: TemplateCompanionSuite[] = [];

  let source: string;
  if (prefab === "rf-heli-electric") {
    const { source: next } = insertPrefabSections(
      createPrefabShellSource("RfHeliE"),
      [...ROTORFLIGHT_ELECTRIC_LAYOUT_ORDER],
      lcd,
    );
    source = next;
    companionSuites.push("rf-heli-electric");
  } else if (prefab === "rf-heli-nitro") {
    const { source: next } = insertPrefabSections(
      createPrefabShellSource("RfHeliN"),
      [...ROTORFLIGHT_NITRO_LAYOUT_ORDER],
      lcd,
    );
    source = next;
    companionSuites.push("sensor-dump");
  } else if (prefab === "battery-tool") {
    source = getLayoutTemplateBoardSource("battery-tool", lcd);
    companionSuites.push("batt-select");
  } else if (prefab === "flight-logger") {
    source = getLayoutTemplateBoardSource("flight-logger", lcd);
    companionSuites.push("flight-logger");
  } else {
    source = getLayoutTemplateBoardSource(prefab, lcd);
  }

  return {
    source,
    protocol: template.protocol,
    prefab,
    companionSuites,
  };
}
