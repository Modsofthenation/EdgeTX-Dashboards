import { existsSync } from "node:fs";
import type { TelemetryProtocol } from "@widget-gen/shared";
import { hashString } from "./designVariation.ts";
import {
  getWidgetLuaPath,
  sanitizeWidgetName,
  WIDGET_NAME_PATTERN,
} from "./paths.ts";

const PROTO_PREFIX: Record<TelemetryProtocol, string> = {
  betaflight: "Bf",
  rotorflight: "Rf",
  "generic-crsf": "Cr",
};

/** Ordered by specificity — first matches win for primary topic. */
const TOPIC_RULES: Array<{ pattern: RegExp; tag: string }> = [
  {
    pattern:
      /flight\s*log|logger|logging|log viewer|record flight|last flight/i,
    tag: "FltLog",
  },
  { pattern: /heli|helicopter|rotorcraft|headspeed|head speed/i, tag: "Heli" },
  { pattern: /gps|geofenc|waypoint|\bsats?\b|satellite/i, tag: "GPS" },
  {
    pattern: /model\s*(image|photo|picture)|plane image|show.*model/i,
    tag: "Model",
  },
  { pattern: /battery|voltage|\bbatt\b|rxbt|cell volt/i, tag: "Batt" },
  { pattern: /\brpm\b|motor|esc|esct|mott|hspd/i, tag: "Motor" },
  { pattern: /link|rssi|rqly|lqi|signal quality/i, tag: "Link" },
  { pattern: /timer|duration|armed|flight time/i, tag: "Timer" },
  { pattern: /altitude|\balt\b|baro|vario/i, tag: "Alt" },
  { pattern: /speed|groundspeed|airspeed|\bspd\b/i, tag: "Spd" },
  { pattern: /current|power|amps|ampere|watt/i, tag: "Pwr" },
  { pattern: /monitor|dashboard|telemetry|display/i, tag: "Dash" },
];

const STOP_WORDS = new Set([
  "with",
  "that",
  "this",
  "have",
  "show",
  "make",
  "want",
  "need",
  "like",
  "dashboard",
  "widget",
  "screen",
  "edgetx",
  "betaflight",
  "rotorflight",
]);

const SUFFIX_LEN = 2;
const SUFFIX_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

function randomSuffix(seed: number, length = SUFFIX_LEN): string {
  let state = seed >>> 0;
  let out = "";
  for (let i = 0; i < length; i++) {
    state = (state * 1664525 + 1013904223) >>> 0;
    out += SUFFIX_CHARS[state % SUFFIX_CHARS.length];
  }
  return out;
}

function detectTopicTags(prompt: string): string[] {
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const rule of TOPIC_RULES) {
    if (rule.pattern.test(prompt) && !seen.has(rule.tag)) {
      tags.push(rule.tag);
      seen.add(rule.tag);
    }
  }
  return tags;
}

function fallbackTopicTag(prompt: string): string {
  const words = prompt.match(/\b[A-Za-z]{4,}\b/g) ?? [];
  for (const word of words) {
    if (STOP_WORDS.has(word.toLowerCase())) continue;
    const tag = word.charAt(0).toUpperCase() + word.slice(1, 4).toLowerCase();
    if (tag.length >= 2) return tag;
  }
  return "Dash";
}

function combineWithinBudget(parts: string[], budget: number): string {
  if (budget <= 0) return "";
  let out = "";
  for (const part of parts) {
    const next = out + part;
    if (next.length <= budget) {
      out = next;
      continue;
    }
    const remaining = budget - out.length;
    if (remaining > 0) {
      out += part.slice(0, remaining);
    }
    break;
  }
  return out;
}

function normalizeWidgetName(name: string): string {
  const trimmed = name.slice(0, 10);
  sanitizeWidgetName(trimmed);
  return trimmed;
}

/** Build a descriptive, unique-ish widget folder name (≤10 chars, alphanumeric). */
export function suggestWidgetName(
  prompt: string,
  protocol: TelemetryProtocol,
  seed: number,
): string {
  const proto = PROTO_PREFIX[protocol];
  const budget = 10 - proto.length - SUFFIX_LEN;
  const topics = detectTopicTags(prompt);
  const semantic = combineWithinBudget(
    topics.length > 0 ? topics : [fallbackTopicTag(prompt)],
    budget,
  );
  const suffix = randomSuffix(seed ^ hashString(prompt));
  return normalizeWidgetName(`${proto}${semantic}${suffix}`);
}

export function widgetFolderExists(name: string): boolean {
  try {
    return existsSync(getWidgetLuaPath(name));
  } catch {
    return false;
  }
}

/** Pick a name that is not already used under generated/. */
export function allocateWidgetName(
  prompt: string,
  protocol: TelemetryProtocol,
  seed: number,
  exists: (name: string) => boolean = widgetFolderExists,
): string {
  for (let attempt = 0; attempt < 64; attempt++) {
    const candidate = suggestWidgetName(
      prompt,
      protocol,
      seed + attempt * 9973,
    );
    if (!exists(candidate) && WIDGET_NAME_PATTERN.test(candidate)) {
      return candidate;
    }
  }

  for (let attempt = 0; attempt < 64; attempt++) {
    const proto = PROTO_PREFIX[protocol];
    const suffix = randomSuffix(seed + attempt * 13_371, 10 - proto.length);
    const candidate = normalizeWidgetName(`${proto}${suffix}`);
    if (!exists(candidate)) return candidate;
  }

  throw new Error("Could not allocate a unique widget name");
}
