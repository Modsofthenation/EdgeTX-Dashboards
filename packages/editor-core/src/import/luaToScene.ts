import { extractRefreshBody } from "@widget-gen/shared";
import {
  interpretWidgetLayout,
  isInterpretationReliable,
  BASE_MOCK,
} from "@widget-gen/layout-verify";
import { resolvePreviewDimensions } from "@widget-gen/shared";
import { resetElementIdCounter } from "../ids.js";
import type { LuaToSceneResult, WidgetScene } from "../types.js";
import {
  buildLcdCallGates,
  parseSimulateFromSource,
  parseTelemetryBindings,
  parseWidgetName,
  parseWidgetOptions,
} from "./parseMetadata.js";
import { recordsToElements } from "./recordsToElements.js";

/** Import an EdgeTX widget Lua source into an editable scene. */
export function luaToScene(source: string): LuaToSceneResult {
  resetElementIdCounter();
  const warnings: string[] = [];

  const simulate = parseSimulateFromSource(source);
  const name = parseWidgetName(source);
  const options = parseWidgetOptions(source);
  const telemetry = parseTelemetryBindings(source);
  const telemetryKeys = new Set(telemetry.map((t) => t.key));

  const dims = resolvePreviewDimensions(source);
  const zoneOffsetX = dims.zoneX;
  const zoneOffsetY = dims.zoneY;

  const scenario = {
    id: "import",
    mock: BASE_MOCK,
    options: Object.fromEntries(options.map((o) => [o.name, o.defaultValue])) as Record<
      string,
      0 | 1
    >,
  };

  const { records, warnings: parseWarnings, skippedTextCount } = interpretWidgetLayout(
    source,
    scenario
  );

  warnings.push(...parseWarnings);
  if (skippedTextCount > 0) {
    warnings.push(`${skippedTextCount} text draw(s) could not be parsed`);
  }

  const annulusReliable = isInterpretationReliable(records);
  if (!annulusReliable) {
    warnings.push("Annulus coordinates may be unreliable — verify after import");
  }

  const refreshBody = extractRefreshBody(source);
  const lcdCallGates = buildLcdCallGates(refreshBody);

  const elements = recordsToElements(
    records,
    zoneOffsetX,
    zoneOffsetY,
    lcdCallGates,
    telemetryKeys,
    annulusReliable
  );

  if (elements.length === 0) {
    warnings.push("No drawable elements imported — scene may be empty");
  }

  const scene: WidgetScene = {
    name,
    simulate,
    options,
    telemetry,
    elements,
  };

  return { scene, warnings };
}
