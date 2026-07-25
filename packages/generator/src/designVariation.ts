import type { TelemetryProtocol } from "@widget-gen/shared";
import type { LayoutArchetypeHint, LayoutArchetypeId } from "./layoutArchetype.ts";
import { pickDashboardPaletteForPrompt, DASHBOARD_PALETTES, type DashboardPalette, buildExplicitColorDirective } from "./themePalettes.ts";
import { wantsRoundedCorners, buildRoundedCornersDirective } from "./roundedCorners.ts";
import { readRoundedCornersGuide } from "./knowledge.ts";

export interface ColorPalette {
  id: string;
  name: string;
  accents: [string, string, string];
  headerStyle: string;
  borderStyle: string;
  background?: string;
  surface?: string;
  hero?: string;
  label?: string;
  rgbSetup?: string;
}

export interface CreativeBrief {
  seed: number;
  palette: ColorPalette;
  compositionVariant: string;
  metricEmphasis: string;
  markdown: string;
}

function toColorPalette(p: DashboardPalette): ColorPalette {
  return {
    id: p.id,
    name: p.name,
    accents: p.accents,
    headerStyle: p.headerStyle,
    borderStyle: p.borderStyle,
    background: p.background,
    surface: p.surface,
    hero: p.hero,
    label: p.label,
    rgbSetup: p.rgbSetup,
  };
}

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

const METRIC_KEYWORDS: Array<{ pattern: RegExp; emphasis: string; rotorflightOnly?: boolean }> = [
  { pattern: /voltage|battery|cell|mah|pack/, emphasis: "Battery voltage and mAh as primary focus" },
  { pattern: /gps|altitude|alt|speed|sats/, emphasis: "GPS altitude and speed as primary focus" },
  { pattern: /link|rssi|rqly|signal/, emphasis: "Link quality and RSSI as primary focus" },
  { pattern: /timer|flight time|armed/, emphasis: "Flight timer and armed state as primary focus" },
  {
    pattern: /headspeed|hspd|rotorflight|heli/,
    emphasis: "Headspeed/RPM and motor temps as primary focus",
    rotorflightOnly: true,
  },
  { pattern: /rpm|motor|esc/, emphasis: "Motor RPM and ESC telemetry as primary focus", rotorflightOnly: true },
  { pattern: /current|power|amps|watt/, emphasis: "Current and power draw as primary focus" },
  { pattern: /logger|log viewer|flight log|history|record flight/, emphasis: "Flight logging and last-flight summary as primary focus" },
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
  for (const { pattern, emphasis, rotorflightOnly } of METRIC_KEYWORDS) {
    if (pattern.test(p)) {
      if (rotorflightOnly && protocol !== "rotorflight") continue;
      return emphasis;
    }
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
  const palette = toColorPalette(pickDashboardPaletteForPrompt(seed, userPrompt));
  const compositions = COMPOSITION_BY_ARCHETYPE[archetype.id];
  const compositionVariant = compositions[Math.floor(seed / DASHBOARD_PALETTES.length) % compositions.length];
  const metricEmphasis = pickMetricEmphasis(userPrompt, protocol, seed);
  const explicitColors = buildExplicitColorDirective(userPrompt);
  const roundedCorners = wantsRoundedCorners(userPrompt)
    ? buildRoundedCornersDirective(readRoundedCornersGuide())
    : null;

  const lines = [
    "## Creative brief (mandatory variety for this run)",
    "Follow this brief unless it **conflicts with the user's explicit request**. Layout and metrics must still obey the **selected telemetry protocol** — never use sensors from another firmware catalog.",
    "",
    `- **Run seed:** ${seed} — use it to vary metric placement, proportions, and accents; do not ignore it.`,
    `- **Layout archetype:** \`${archetype.id}\` — ${archetype.title}`,
    `- **Composition variant:** ${compositionVariant}`,
    `- **Color palette:** ${palette.name} (\`${palette.id}\`) — accents: ${palette.accents.join(", ")}`,
    palette.background ? `- **Background:** ${palette.background}` : "",
    palette.surface ? `- **Cards / surface:** ${palette.surface}` : "",
    palette.hero ? `- **Hero values:** ${palette.hero}` : "",
    palette.label ? `- **Labels:** ${palette.label}` : "",
    palette.rgbSetup ? `- **Suggested RGB locals in create():** ${palette.rgbSetup}` : "",
    `- **Header treatment:** ${palette.headerStyle}`,
    `- **Border / accent treatment:** ${palette.borderStyle}`,
    `- **Metric emphasis:** ${metricEmphasis}`,
    "",
    "Make this dashboard **visibly distinct** from a generic two-column LINK/BATTERY/HEADSPEED card clone.",
    "Vary which metrics sit in which regions. Use the palette accents — not an all-grey layout unless palette is Grey Structure.",
  ];

  if (explicitColors) {
    lines.push("", explicitColors);
  }

  if (roundedCorners) {
    lines.push("", roundedCorners);
  }

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
  return /different layout|new layout|more colorful|more colour|minimal|strip|hero|dense|rearrange|redesign|vibrant|asymmetric|rounded\s+corner|rounded\s+card|rounded\s+grid/.test(
    p
  );
}
