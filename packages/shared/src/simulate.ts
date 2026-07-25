import tx15Profile from "./layouts/tx15.json" with { type: "json" };
import color272Profile from "./layouts/color272.json" with { type: "json" };
import taranis212Profile from "./layouts/taranis212.json" with { type: "json" };
import compact128Profile from "./layouts/compact128.json" with { type: "json" };
import type { LayoutProfileId } from "./radios.ts";

export interface WidgetZoneRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SimulateAnnotation {
  layout: string;
  zone: number;
}

export interface SimulateLayoutProfile {
  radioId: string;
  lcdW: number;
  lcdH: number;
  defaultSimulate: SimulateAnnotation;
  layouts: Record<string, { zones: WidgetZoneRect[] }>;
}

export interface PreviewDimensions {
  lcdW: number;
  lcdH: number;
  zoneX: number;
  zoneY: number;
  zoneW: number;
  zoneH: number;
  layout: string;
  zone: number;
}

const LAYOUT_PROFILES: Record<LayoutProfileId, SimulateLayoutProfile> = {
  tx15: tx15Profile as SimulateLayoutProfile,
  color272: color272Profile as SimulateLayoutProfile,
  taranis212: taranis212Profile as SimulateLayoutProfile,
  compact128: compact128Profile as SimulateLayoutProfile,
};

/** Canonical layout profiles (from packages/shared/src/layouts/*.json). */
export function getSimulateLayoutProfile(
  layoutProfileId: string,
): SimulateLayoutProfile {
  const profile = LAYOUT_PROFILES[layoutProfileId as LayoutProfileId];
  if (!profile) {
    throw new Error(`Simulate layout profile not found: ${layoutProfileId}`);
  }
  return profile;
}

export function tryGetSimulateLayoutProfile(
  layoutProfileId: string,
): SimulateLayoutProfile | null {
  return LAYOUT_PROFILES[layoutProfileId as LayoutProfileId] ?? null;
}

export const TX15_SIMULATE_PROFILE = LAYOUT_PROFILES.tx15;

const TYPE_ANNOTATION = /^---@type\s+(\w+)\s*$/m;
const SIMULATE_ANNOTATION = /^---@simulate\s+(\S+)(?:\s+zone=(\d+))?\s*$/m;

export function parseScriptTypeAnnotation(source: string): string | null {
  const match = source.match(TYPE_ANNOTATION);
  return match?.[1] ?? null;
}

export function parseSimulateAnnotation(
  source: string,
): SimulateAnnotation | null {
  const match = source.match(SIMULATE_ANNOTATION);
  if (!match) return null;
  return {
    layout: match[1],
    zone: match[2] !== undefined ? Number(match[2]) : 0,
  };
}

export function resolveSimulateZone(
  annotation: SimulateAnnotation,
  profile: SimulateLayoutProfile,
): WidgetZoneRect {
  const layout = profile.layouts[annotation.layout];
  if (!layout) {
    return profile.layouts[profile.defaultSimulate.layout].zones[
      profile.defaultSimulate.zone
    ];
  }
  const zone = layout.zones[annotation.zone];
  if (!zone) {
    return layout.zones[0] ?? profile.layouts.Layout1x1.zones[0];
  }
  return zone;
}

export function resolvePreviewDimensions(
  source: string,
  profile: SimulateLayoutProfile = TX15_SIMULATE_PROFILE,
): PreviewDimensions {
  const annotation = parseSimulateAnnotation(source) ?? profile.defaultSimulate;
  const zone = resolveSimulateZone(annotation, profile);
  return {
    lcdW: profile.lcdW,
    lcdH: profile.lcdH,
    zoneX: zone.x,
    zoneY: zone.y,
    zoneW: zone.w,
    zoneH: zone.h,
    layout: annotation.layout,
    zone: annotation.zone,
  };
}

/** True when @simulate zone covers the full LCD (dashboard full-screen mode in WASM sim). */
export function isFullLcdSimulateZone(
  dims: Pick<
    PreviewDimensions,
    "lcdW" | "lcdH" | "zoneX" | "zoneY" | "zoneW" | "zoneH"
  >,
): boolean {
  return (
    dims.zoneX === 0 &&
    dims.zoneY === 0 &&
    dims.zoneW === dims.lcdW &&
    dims.zoneH === dims.lcdH
  );
}

export function ensureDevKitAnnotations(
  source: string,
  profile: SimulateLayoutProfile = TX15_SIMULATE_PROFILE,
  scriptType = "WidgetScript",
): string {
  let body = source.replace(/^\uFEFF/, "");
  const lines: string[] = [];
  const existing = body.split("\n");

  while (existing.length > 0 && /^---@/.test(existing[0].trim())) {
    lines.push(existing.shift()!);
  }

  const hasType = lines.some((l) => TYPE_ANNOTATION.test(l.trim()));
  const hasSimulate = lines.some((l) => SIMULATE_ANNOTATION.test(l.trim()));

  const header: string[] = [];
  if (!hasType) header.push(`---@type ${scriptType}`);
  if (!hasSimulate) {
    const sim = profile.defaultSimulate;
    header.push(`---@simulate ${sim.layout} zone=${sim.zone}`);
  }

  const kept = lines.filter(Boolean);
  const mergedHeader = [...header, ...kept];
  const rest = existing.join("\n").replace(/^\n+/, "");
  const prefix = mergedHeader.join("\n");
  return rest ? `${prefix}\n${rest}` : prefix;
}
