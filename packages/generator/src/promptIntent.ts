/**
 * High-confidence prompt → telemetry sensor coverage checks.
 * Errors when the user clearly asked for a metric available in the protocol
 * catalog but the generated Lua never references it.
 */
import type { ValidationIssue } from "@widget-gen/shared";

function extractUsedSensors(source: string): Set<string> {
  const used = new Set<string>();
  for (const pattern of [
    /cacheSource\s*\(\s*"([^"]+)"\s*\)/g,
    /getSourceIndex\s*\(\s*"([^"]+)"\s*\)/g,
    /getValue\s*\(\s*"([^"]+)"\s*\)/g,
  ]) {
    for (const match of source.matchAll(pattern)) {
      used.add(match[1]);
    }
  }
  return used;
}

export interface PromptIntentRule {
  /** Human label for the missing capability. */
  label: string;
  /** Match against the user prompt (case-insensitive). */
  patterns: RegExp[];
  /** Any of these catalog sensor names satisfies the intent. */
  sensors: string[];
}

/** Conservative keyword→sensor mappings (avoid vague words like "clean"). */
export const PROMPT_INTENT_RULES: PromptIntentRule[] = [
  {
    label: "battery voltage",
    patterns: [
      /\b(?:battery\s+)?voltage\b/i,
      /\brxbt\b/i,
      /\bvbat\b/i,
      /\bbattery\b/i,
    ],
    sensors: ["RxBt"],
  },
  {
    label: "link quality",
    patterns: [/\blink\s*quality\b/i, /\brqly\b/i, /\bLQ\b/],
    sensors: ["RQLY"],
  },
  {
    label: "GPS satellites",
    patterns: [/\bgps\s*sats?\b/i, /\bsatellites?\b/i, /\bsats\b/i],
    sensors: ["Sats"],
  },
  {
    label: "flight mode",
    patterns: [/\bflight\s*mode\b/i, /\bFM\b/],
    sensors: ["FM"],
  },
  {
    label: "headspeed",
    patterns: [/\bheads?peed\b/i, /\bhspd\b/i],
    sensors: ["HSpd", "RPM"],
  },
  {
    label: "ESC temperature",
    patterns: [/\besc\s*temp(?:erature)?\b/i, /\besct\b/i],
    sensors: ["EscT"],
  },
  {
    label: "motor temperature",
    patterns: [/\bmotor\s*temp(?:erature)?\b/i, /\bmott\b/i],
    sensors: ["MotT"],
  },
  {
    label: "current draw",
    patterns: [/\bcurrent\s+draw\b/i, /\bamps?\b/i, /\bcurr\b/i],
    sensors: ["Curr"],
  },
  {
    label: "consumed capacity",
    patterns: [/\bmAh\b/i, /\bcapacity\b/i, /\bconsumed\b/i],
    sensors: ["Capa"],
  },
  {
    label: "RSSI",
    patterns: [/\brssi\b/i, /\b1rss\b/i],
    sensors: ["1RSS", "TRSS"],
  },
];

export interface PromptIntentOptions {
  /** Sensors present in the selected protocol catalog. */
  knownSensors?: string[];
  /**
   * When true (default), missing high-confidence sensors are errors.
   * When false, they are warnings.
   */
  strict?: boolean;
}

/**
 * Compare user prompt intent against sensors referenced in Lua.
 * Only fires when at least one candidate sensor exists in the protocol catalog.
 */
export function validatePromptIntent(
  prompt: string,
  source: string,
  options?: PromptIntentOptions,
): ValidationIssue[] {
  if (!prompt.trim()) return [];

  const known = new Set(options?.knownSensors ?? []);
  const used = extractUsedSensors(source);
  const severity = options?.strict === false ? "warning" : "error";
  const issues: ValidationIssue[] = [];

  for (const rule of PROMPT_INTENT_RULES) {
    const matched = rule.patterns.some((p) => p.test(prompt));
    if (!matched) continue;

    const catalogHits = rule.sensors.filter(
      (s) => known.size === 0 || known.has(s),
    );
    if (catalogHits.length === 0) continue;

    const covered = catalogHits.some((s) => used.has(s));
    if (covered) continue;

    issues.push({
      severity,
      message: `Prompt asks for ${rule.label} but widget never references ${catalogHits.join(" / ")} — add getSourceIndex("${catalogHits[0]}") (or an allowed alternate) so the layout matches the request`,
    });
  }

  // Hero / large readout requests should use DBLSIZE for hierarchy.
  if (
    /\b(?:large|hero|huge|big)\b/i.test(prompt) &&
    /\b(?:voltage|battery|readout|vbat|rxbt)\b/i.test(prompt) &&
    !/\bDBLSIZE\b/.test(source)
  ) {
    issues.push({
      severity: "warning",
      message:
        "Prompt asks for a large/hero voltage readout but source has no DBLSIZE text — use lcd.drawText(..., DBLSIZE + color) for the primary value",
    });
  }

  return issues;
}
