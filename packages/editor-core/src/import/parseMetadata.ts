import {
  parseSimulateAnnotation,
  TX15_SIMULATE_PROFILE,
} from "@widget-gen/shared";
import type { TelemetryBinding, WidgetOption } from "../types.ts";

const NAME_PATTERN = /local\s+name\s*=\s*"([^"]+)"/;
const OPTION_ROW = /\{\s*"([^"]+)"\s*,\s*BOOL\s*,\s*([01])\s*\}/g;
const SRC_ENTRY = /(\w+)\s*=\s*cacheSource\("([^"]+)"\)/g;

export function parseWidgetName(source: string): string {
  const match = source.match(NAME_PATTERN);
  return match?.[1]?.slice(0, 10) ?? "Widget";
}

export function parseWidgetOptions(source: string): WidgetOption[] {
  const options: WidgetOption[] = [];
  const optionsBlock = source.match(/local\s+options\s*=\s*\{([\s\S]*?)\n\}/);
  if (!optionsBlock) return options;

  let match: RegExpExecArray | null;
  const re = new RegExp(OPTION_ROW.source, "g");
  while ((match = re.exec(optionsBlock[1]!)) !== null) {
    options.push({
      name: match[1]!,
      defaultValue: match[2] === "1" ? 1 : 0,
    });
  }
  return options;
}

export function parseTelemetryBindings(source: string): TelemetryBinding[] {
  const bindings: TelemetryBinding[] = [];
  const createBlock = source.match(
    /local\s+function\s+create[\s\S]*?src\s*=\s*\{([\s\S]*?)\}/,
  );
  if (!createBlock) return bindings;

  let match: RegExpExecArray | null;
  const re = new RegExp(SRC_ENTRY.source, "g");
  while ((match = re.exec(createBlock[1]!)) !== null) {
    bindings.push({ key: match[1]!, sensor: match[2]! });
  }
  return bindings;
}

export function parseSimulateFromSource(source: string) {
  return (
    parseSimulateAnnotation(source) ?? TX15_SIMULATE_PROFILE.defaultSimulate
  );
}

/** Option gate per lcd.draw* call in refresh() body order (excludes clear). */
export function buildLcdCallGates(refreshBody: string): (string | undefined)[] {
  const gates: (string | undefined)[] = [];
  const lines = refreshBody.split("\n");
  let currentGate: string | undefined;
  let depth = 0;

  for (const raw of lines) {
    const line = raw.trim();
    const gateOpen = line.match(
      /^if\s+widget\.options\.(\w+)\s*==\s*1\s+then$/,
    );
    if (gateOpen && depth === 0) {
      currentGate = gateOpen[1];
      depth = 1;
      continue;
    }

    if (currentGate) {
      if (line.startsWith("if ")) depth++;
      if (line === "end") {
        depth--;
        if (depth === 0) currentGate = undefined;
        continue;
      }
    }

    if (/lcd\.draw\w*\(/.test(line)) {
      gates.push(currentGate);
    }
  }

  return gates;
}
