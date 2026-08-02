import type { DrawRecord } from "@widget-gen/layout-verify";
import { fontSizeToFlag } from "@widget-gen/layout-verify";
import { hexToEdgeColor } from "../colors.ts";
import { newElementId } from "../ids.ts";
import type { EditorElement, TextBinding, TextFormat } from "../types.ts";

function inferTextBinding(
  text: string,
  telemetryKeys: Set<string>,
): TextBinding | undefined {
  const percentMatch = text.match(/^(\d+)%$/);
  if (percentMatch) {
    if (telemetryKeys.has("rqly"))
      return { sensorKey: "rqly", format: "percent" };
  }

  const floatMatch = text.match(/^(\d+\.\d+)$/);
  if (floatMatch) {
    for (const key of telemetryKeys) {
      if (key === "rxbt") return { sensorKey: key, format: "float1" };
    }
  }

  const ampsMatch = text.match(/^(\d+\.\d+) A$/);
  if (ampsMatch) {
    return { sensorKey: "curr", format: "float1_amps" };
  }

  const rssiMatch = text.match(/^RSSI (\d+)$/);
  if (rssiMatch) {
    return { sensorKey: "rssi", format: "raw", prefix: "RSSI " };
  }

  const altMatch = text.match(/^(\d+)$/);
  if (altMatch && telemetryKeys.has("alt")) {
    return { sensorKey: "alt", format: "raw" };
  }

  return undefined;
}

function fontSizeFromRecord(record: DrawRecord): number {
  return record.fontSize ?? 17;
}

function mapRecordToElement(
  record: DrawRecord,
  zoneOffsetX: number,
  zoneOffsetY: number,
  optionGate: string | undefined,
  telemetryKeys: Set<string>,
  importConfidence: "high" | "low",
): EditorElement | null {
  const id = newElementId();
  const base = {
    id,
    visible: true,
    optionGate,
    importConfidence,
    sourceLine: record.sourceLine,
  };

  switch (record.kind) {
    case "clear":
      return null;
    case "text": {
      const text = record.text ?? "";
      const binding = inferTextBinding(text, telemetryKeys);
      const color = hexToEdgeColor(record.color);
      const fontSize = fontSizeFromRecord(record);
      const fontFlags = [fontSizeToFlag(fontSize)];

      if (binding) {
        return {
          ...base,
          kind: "text",
          x: (record.x ?? 0) - zoneOffsetX,
          y: (record.y ?? 0) - zoneOffsetY,
          binding,
          fontSize,
          color,
          textAlign: record.textAlign,
          fontFlags,
          label: `Text (${binding.sensorKey})`,
        };
      }

      return {
        ...base,
        kind: "text",
        x: (record.x ?? 0) - zoneOffsetX,
        y: (record.y ?? 0) - zoneOffsetY,
        content: text,
        fontSize,
        color,
        textAlign: record.textAlign,
        fontFlags,
        label: text.slice(0, 20) || "Text",
      };
    }
    case "filledRect":
      return {
        ...base,
        kind: "filledRect",
        x: (record.x ?? 0) - zoneOffsetX,
        y: (record.y ?? 0) - zoneOffsetY,
        w: record.w ?? 0,
        h: record.h ?? 0,
        color: record.color ?? "#404040",
        label: "Filled rect",
      };
    case "rect":
      return {
        ...base,
        kind: "rect",
        x: (record.x ?? 0) - zoneOffsetX,
        y: (record.y ?? 0) - zoneOffsetY,
        w: record.w ?? 0,
        h: record.h ?? 0,
        color: hexToEdgeColor(record.color, "GREY"),
        label: "Rect",
      };
    case "line":
      return {
        ...base,
        kind: "line",
        x1: (record.x ?? 0) - zoneOffsetX,
        y1: (record.y ?? 0) - zoneOffsetY,
        x2: (record.x2 ?? 0) - zoneOffsetX,
        y2: (record.y2 ?? 0) - zoneOffsetY,
        color: hexToEdgeColor(record.color),
        pattern: "SOLID",
        label: "Line",
      };
    case "gauge":
      return {
        ...base,
        kind: "gauge",
        x: (record.x ?? 0) - zoneOffsetX,
        y: (record.y ?? 0) - zoneOffsetY,
        w: record.w ?? 0,
        h: record.h ?? 0,
        color: hexToEdgeColor(record.color, "GREEN"),
        fill: record.fill ?? 0,
        maxFill: record.maxFill ?? 100,
        label: "Gauge",
      };
    case "circle":
    case "filledCircle":
      return {
        ...base,
        kind: record.kind,
        x: (record.x ?? 0) - zoneOffsetX,
        y: (record.y ?? 0) - zoneOffsetY,
        r: record.r ?? 0,
        color: hexToEdgeColor(record.color),
        label: record.kind === "circle" ? "Circle" : "Filled circle",
      };
    case "arc":
      return {
        ...base,
        kind: "arc",
        x: (record.x ?? 0) - zoneOffsetX,
        y: (record.y ?? 0) - zoneOffsetY,
        r: record.r ?? 0,
        startAngle: record.startAngle ?? 0,
        endAngle: record.endAngle ?? 360,
        color: hexToEdgeColor(record.color, "BRIGHTGREEN"),
        label: "Arc",
      };
    case "annulus":
      return {
        ...base,
        kind: "annulus",
        x: (record.x ?? 0) - zoneOffsetX,
        y: (record.y ?? 0) - zoneOffsetY,
        rIn: record.rIn ?? 0,
        rOut: record.rOut ?? 0,
        startAngle: record.startAngle ?? 270,
        endAngle: record.endAngle ?? 360,
        color: hexToEdgeColor(record.color, "BRIGHTGREEN"),
        importConfidence,
        label: "Annulus",
      };
    case "bitmap":
      return {
        ...base,
        kind: "bitmap",
        x: (record.x ?? 0) - zoneOffsetX,
        y: (record.y ?? 0) - zoneOffsetY,
        placeholder: "model",
        label: "Bitmap",
      };
    default:
      return null;
  }
}

export function recordsToElements(
  records: DrawRecord[],
  zoneOffsetX: number,
  zoneOffsetY: number,
  lcdCallGates: (string | undefined)[],
  telemetryKeys: Set<string>,
  annulusReliable: boolean,
): EditorElement[] {
  const elements: EditorElement[] = [];
  let gateIndex = 0;

  for (const record of records) {
    if (record.kind === "clear") continue;

    const optionGate = lcdCallGates[gateIndex];
    gateIndex++;

    const confidence =
      record.kind === "annulus" && !annulusReliable ? "low" : "high";
    const el = mapRecordToElement(
      record,
      zoneOffsetX,
      zoneOffsetY,
      optionGate,
      telemetryKeys,
      confidence,
    );
    if (el) elements.push(el);
  }

  return elements;
}

export type { TextFormat };
