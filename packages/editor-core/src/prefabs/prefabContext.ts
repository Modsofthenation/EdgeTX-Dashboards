import { findRefreshBodyEndIndex } from "@widget-gen/shared";
import { getPrefabSection } from "./registry.ts";
import type { PrefabSection } from "./types.ts";

const PREFAB_MARKER = /^\s*--\s*prefab:([\w-]+)\s*$/;

export interface PrefabSourceSpan {
  prefabId: string;
  /** 1-based first line of the marker. */
  startLine: number;
  /** 1-based last line inclusive before the next prefab marker or refresh end. */
  endLine: number;
}

/** Locate `-- prefab:<id>` blocks inside refresh(). */
export function listPrefabSpans(source: string): PrefabSourceSpan[] {
  const lines = source.split("\n");
  const starts: { prefabId: string; startLine: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]!.match(PREFAB_MARKER);
    if (m) starts.push({ prefabId: m[1]!, startLine: i + 1 });
  }
  if (starts.length === 0) return [];

  const bodyEndIdx = findRefreshBodyEndIndex(source);
  const refreshEndLine =
    bodyEndIdx >= 0
      ? source.slice(0, bodyEndIdx).split("\n").length
      : lines.length;

  const spans: PrefabSourceSpan[] = [];
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i]!;
    const nextStart = starts[i + 1]?.startLine;
    const endLine = nextStart != null ? nextStart - 1 : refreshEndLine - 1;
    spans.push({
      prefabId: start.prefabId,
      startLine: start.startLine,
      endLine: Math.max(start.startLine, endLine),
    });
  }
  return spans;
}

/** Prefab id owning a 1-based source line, if any. */
export function prefabIdForSourceLine(
  source: string,
  sourceLine: number | undefined,
): string | null {
  if (sourceLine == null || sourceLine < 1) return null;
  const spans = listPrefabSpans(source);
  for (const span of spans) {
    if (sourceLine >= span.startLine && sourceLine <= span.endLine) {
      return span.prefabId;
    }
  }
  return null;
}

export interface PrefabSensorSlot {
  key: string;
  sensor: string;
  label: string;
  defaultSensor: string;
  required: boolean;
}

/**
 * Sensor slots for a prefab (defaults from catalog) merged with live src bindings.
 */
export function resolvePrefabSensorSlots(
  prefab: PrefabSection,
  liveBindings: { key: string; sensor: string }[],
): PrefabSensorSlot[] {
  const live = new Map(liveBindings.map((b) => [b.key, b.sensor]));
  const required = new Set(prefab.requiredSensors);
  return Object.entries(prefab.createSrcBindings).map(
    ([key, defaultSensor]) => {
      const sensor = live.get(key) ?? defaultSensor;
      return {
        key,
        sensor,
        defaultSensor,
        label: prefab.srcSlotLabels?.[key] ?? humanizeSrcKey(key),
        required: required.has(defaultSensor) || required.has(sensor),
      };
    },
  );
}

export function getPrefabSensorSlotsForId(
  prefabId: string,
  liveBindings: { key: string; sensor: string }[],
): PrefabSensorSlot[] | null {
  const prefab = getPrefabSection(prefabId);
  if (!prefab) return null;
  return resolvePrefabSensorSlots(prefab, liveBindings);
}

function humanizeSrcKey(key: string): string {
  const known: Record<string, string> = {
    rqly: "Link quality",
    rss1: "RSSI 1",
    fm: "Flight mode",
    gov: "Governor",
    hspd: "Headspeed",
    rpm: "RPM",
    tspd: "Tail RPM",
    curr: "Current",
    rxbt: "Pack voltage",
    vcel: "Cell voltage",
    vbec: "BEC voltage",
    esct: "ESC temp",
    mott: "Motor temp",
    batp: "Battery %",
    capa: "Capacity",
    vbat: "Pack voltage (Vbat)",
    pitch: "Pitch",
    roll: "Roll",
    alt: "Altitude",
    gspd: "Ground speed",
    sats: "Satellites",
    rssi: "RSSI",
  };
  return known[key] ?? key;
}
