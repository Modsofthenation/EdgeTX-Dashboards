import type { TelemetryProtocol } from "@widget-gen/shared";
import type { LayoutArchetypeHint, LayoutArchetypeId } from "./layoutArchetype.js";

export interface ColorPalette {
  id: string;
  name: string;
  accents: [string, string, string];
  headerStyle: string;
  borderStyle: string;
}

export interface CreativeBrief {
  seed: number;
  palette: ColorPalette;
  compositionVariant: string;
  metricEmphasis: string;
  markdown: string;
}

const PALETTES: ColorPalette[] = [
  {
    id: "cyan-lime",
    name: "Cyan / Lime",
    accents: ["CYAN", "LIME", "YELLOW"],
    headerStyle: "4px LIME accent stripe under header bar",
    borderStyle: "CYAN card borders, LIME hero values",
  },
  {
    id: "magenta-orange",
    name: "Magenta / Orange",
    accents: ["MAGENTA", "ORANGE", "YELLOW"],
    headerStyle: "Colored title text in MAGENTA on dark header",
    borderStyle: "MAGENTA dividers, ORANGE status chips",
  },
  {
    id: "yellow-cyan",
    name: "Yellow / Cyan",
    accents: ["YELLOW", "CYAN", "GREEN"],
    headerStyle: "YELLOW title, CYAN footer accents",
    borderStyle: "YELLOW hero, CYAN secondary metrics",
  },
  {
    id: "muted-teal",
    name: "Muted Teal",
    accents: ["CYAN", "GREEN", "WHITE"],
    headerStyle: "Subtle CYAN header line, mostly GREY structure",
    borderStyle: "TEAL-tinted borders (CYAN at 50% visual weight)",
  },
  {
    id: "warm-amber",
    name: "Warm Amber",
    accents: ["ORANGE", "YELLOW", "GREEN"],
    headerStyle: "ORANGE accent stripe, WHITE labels",
    borderStyle: "ORANGE borders on battery sections, GREEN link",
  },
  {
    id: "grey-structure",
    name: "Grey Structure",
    accents: ["GREY", "WHITE", "GREEN"],
    headerStyle: "Flat GREY header bar, single GREEN accent metric",
    borderStyle: "GREY borders with one GREEN highlight element",
  },
];

const COMPOSITION_BY_ARCHETYPE: Record<LayoutArchetypeId, string[]> = {
  "card-grid": [
    "Asymmetric card heights — left column taller than right",
    "Full-width hero band between header and cards",
    "Footer as inline status chips instead of full-width bar",
  ],
  "hero-minimal": [
    "Hero metric top-right with secondary row bottom-left",
    "Centered hero with corner telemetry stack",
    "Large hero left-aligned, empty space right for status",
  ],
  "strip-board": [
    "Four equal strips with label above value",
    "Three wide strips with mini progress bars at bottom",
    "Left-heavy: one wide strip + two narrow strips",
  ],
  "quad-overview": [
    "Timer centered with battery/link bars flanking",
    "Armed indicator as top banner, timer below",
    "Compact rows with horizontal RSSI/battery bars",
  ],
  "heli-rotorflight": [
    "Headspeed hero right, link stack left — vary card proportions",
    "Motor temps as horizontal strip, not second card row",
    "RQLY blocks integrated into header instead of left card",
  ],
  "telemetry-dense": [
    "3×3 grid with alternating row backgrounds",
    "2×4 grid with colored column dividers",
    "Dense cells grouped by category with section headers",
  ],
  "flight-logger-suite": [
    "Dashboard top half, last-flight summary band below",
    "Live metrics strip + log status footer",
  ],
  "battery-tool-suite": [
    "Battery hero with cell grid below",
    "Voltage + mAh side-by-side with pack name header",
  ],
};

const METRIC_KEYWORDS: Array<{ pattern: RegExp; emphasis: string }> = [
  { pattern: /voltage|battery|cell|mah|pack/, emphasis: "Battery voltage and mAh as primary focus" },
  { pattern: /gps|altitude|alt|speed|sats/, emphasis: "GPS altitude and speed as primary focus" },
  { pattern: /link|rssi|rqly|signal/, emphasis: "Link quality and RSSI as primary focus" },
  { pattern: /timer|flight time|armed/, emphasis: "Flight timer and armed state as primary focus" },
  { pattern: /headspeed|hspd|rpm|motor|esc|rotorflight|heli/, emphasis: "Headspeed/RPM and motor temps as primary focus" },
  { pattern: /current|power|amps|watt/, emphasis: "Current and power draw as primary focus" },
];

const ROTORFLIGHT_METRICS = [
  "Headspeed/RPM hero",
  "Battery voltage stack",
  "RQLY link blocks",
  "Motor/ESC temperatures",
  "Current + power footer",
];

const BETAFLIGHT_METRICS = [
  "Battery voltage",
  "Link RSSI/RQLY",
  "GPS altitude",
  "Flight timer",
  "Flight mode",
];

export function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function deriveVariationSeed(sessionId: string, runIndex = 0): number {
  return hashString(`${sessionId}:${runIndex}`);
}

function pickMetricEmphasis(
  userPrompt: string,
  protocol: TelemetryProtocol,
  seed: number
): string {
  const p = userPrompt.toLowerCase();
  for (const { pattern, emphasis } of METRIC_KEYWORDS) {
    if (pattern.test(p)) return emphasis;
  }

  const pool = protocol === "rotorflight" ? ROTORFLIGHT_METRICS : BETAFLIGHT_METRICS;
  return pool[seed % pool.length];
}

export function buildCreativeBrief(
  seed: number,
  archetype: LayoutArchetypeHint,
  protocol: TelemetryProtocol,
  userPrompt: string
): CreativeBrief {
  const palette = PALETTES[seed % PALETTES.length];
  const compositions = COMPOSITION_BY_ARCHETYPE[archetype.id];
  const compositionVariant = compositions[Math.floor(seed / PALETTES.length) % compositions.length];
  const metricEmphasis = pickMetricEmphasis(userPrompt, protocol, seed);

  const lines = [
    "## Creative brief (mandatory variety for this run)",
    "Follow this brief unless it **conflicts with the user's explicit request**. The user request always wins.",
    "",
    `- **Run seed:** ${seed} — use it to vary metric placement, proportions, and accents; do not ignore it.`,
    `- **Layout archetype:** \`${archetype.id}\` — ${archetype.title}`,
    `- **Composition variant:** ${compositionVariant}`,
    `- **Color palette:** ${palette.name} — accents: ${palette.accents.join(", ")}`,
    `- **Header treatment:** ${palette.headerStyle}`,
    `- **Border / accent treatment:** ${palette.borderStyle}`,
    `- **Metric emphasis:** ${metricEmphasis}`,
    "",
    "Make this dashboard **visibly distinct** from a generic two-column LINK/BATTERY/HEADSPEED card clone.",
    "Vary which metrics sit in which regions. Use the palette accents — not an all-grey layout unless palette is Grey Structure.",
  ];

  return {
    seed,
    palette,
    compositionVariant,
    metricEmphasis,
    markdown: lines.join("\n"),
  };
}

/** Bump run index when refinement explicitly changes layout intent. */
export function shouldBumpRunIndexForRefine(prompt: string): boolean {
  const p = prompt.toLowerCase();
  return /different layout|new layout|more colorful|more colour|minimal|strip|hero|dense|rearrange|redesign|vibrant|asymmetric/.test(
    p
  );
}
