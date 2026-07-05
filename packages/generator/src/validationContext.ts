import type { SimulateLayoutProfile, TelemetryProtocol } from "@widget-gen/shared";
import { loadRadioProfile, loadTelemetryCatalog, loadSimulateLayoutProfile } from "./knowledge.js";
import type { ValidateWidgetOptions } from "./validate.js";
import type { LayoutArchetypeId } from "./layoutArchetype.js";
import { getActiveLayoutArchetype } from "./variationContext.js";

export interface ReleaseValidationContext {
  radioId: string;
  protocol: TelemetryProtocol;
  simulateProfile: SimulateLayoutProfile;
  validateOptions: ValidateWidgetOptions;
}

/** Build pure validation options for a release check. */
export function buildReleaseValidationContext(
  protocol: TelemetryProtocol,
  radioId = "tx15",
  strictTelemetry = true,
  layoutArchetype?: LayoutArchetypeId
): ReleaseValidationContext {
  const radio = loadRadioProfile(radioId);
  const catalog = loadTelemetryCatalog(protocol);
  const simulateProfile = loadSimulateLayoutProfile(radioId);

  return {
    radioId,
    protocol,
    simulateProfile,
    validateOptions: {
      maxOptions: radio.maxOptions,
      knownSensors: catalog.sensors.map((s) => s.name),
      strictTelemetry,
      simulateProfile,
      strictDevKit: true,
      layoutArchetype: layoutArchetype ?? getActiveLayoutArchetype(),
    },
  };
}
