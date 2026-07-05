import type { TelemetryProtocol } from "@widget-gen/shared";
import { hashString } from "./designVariation.js";

export type LayoutArchetypeId =
  | "card-grid"
  | "hero-minimal"
  | "strip-board"
  | "quad-overview"
  | "heli-rotorflight"
  | "telemetry-dense"
  | "flight-logger-suite"
  | "battery-tool-suite";

export interface LayoutArchetypeHint {
  id: LayoutArchetypeId;
  title: string;
  summary: string;
  layoutNotes: string;
  companionScripts?: string;
}

const ARCHETYPES: Record<LayoutArchetypeId, LayoutArchetypeHint> = {
  "card-grid": {
    id: "card-grid",
    title: "Card grid dashboard",
    summary: "Two-column metric cards with a full-width lower band and status footer.",
    layoutNotes:
      "Header 40px, two 118px cards side-by-side, one full-width card below, footer 28px. Vary which metrics occupy each card based on the user prompt.",
  },
  "hero-minimal": {
    id: "hero-minimal",
    title: "Hero minimal",
    summary: "One DBLSIZE hero metric centered or top-right with 2–3 small secondary readouts.",
    layoutNotes:
      "No card grid. Large hero value (voltage, altitude, or headspeed). Secondary metrics in a single row or corner stack. Lots of negative space.",
  },
  "strip-board": {
    id: "strip-board",
    title: "Horizontal strip board",
    summary: "Three or four equal vertical strips across the width, each with label + value.",
    layoutNotes:
      "Divide LCD_W into 3–4 columns with 8px gutters. Each strip: SMLSIZE label top, MIDSIZE value center, optional mini bar at bottom.",
  },
  "quad-overview": {
    id: "quad-overview",
    title: "Quad / FPV overview",
    summary: "Battery + link bars on top, flight timer center, GPS/alt/speed row, armed indicator.",
    layoutNotes:
      "Emphasize timer, battery bar, and RSSI bar. Use ORANGE for armed state. Compact rows, not heli cards. **Mandatory:** reserved rectangles for every block (header, bars, gauge+satellite labels, strip cards, footer). Gauge effective height = `rOut*2 + satelliteBelowH()` — include amp/`LEFT` labels in budget before placing stripY. `barsBlockH` must derive from `barsPctY` (same formula as last drawText row). Every drawText → `textRowRect` in `textFootprintRects`; run `anyTextForeignOverlap` before draw. Compute mainTop/mainBottom before drawing; never clamp mainH to a literal after stripY is set. Phase 1 = fills/annulus, phase 2 = all text. See layout-reserved-rects.md and tx15-bfdash8f-whoop-dashboard.lua.",
  },
  "heli-rotorflight": {
    id: "heli-rotorflight",
    title: "Rotorflight heli board",
    summary: "Heli-specific: link blocks, battery, headspeed hero, motor temps, current/power footer.",
    layoutNotes:
      "Follow rotorflight DBK telemetry idioms (RQLY blocks, HSpd/RPM hero, Cur/Pwr footer) but vary layout per creative brief — not a fixed two-card clone.",
  },
  "telemetry-dense": {
    id: "telemetry-dense",
    title: "Dense telemetry grid",
    summary: "Six to eight small readouts in a 2×3 or 3×3 grid for power users.",
    layoutNotes:
      "Small cells (no large cards). Each cell: label + value only. Use BOOL options to hide rows. Good for 'show everything' requests.",
  },
  "flight-logger-suite": {
    id: "flight-logger-suite",
    title: "Dashboard + flight logger",
    summary: "Main dashboard plus SCRIPTS/TELEMETRY logger and optional log viewer tool.",
    layoutNotes:
      "Dashboard shows live metrics + last-flight summary line. Generate companion telemetry script that logs to SD and a TOOLS script to browse logs.",
    companionScripts:
      "telemetry/flight_log.lua (SCRIPTS/TELEMETRY) + tools/log_view.lua (SCRIPTS/TOOLS). Document both in INSTALL.md.",
  },
  "battery-tool-suite": {
    id: "battery-tool-suite",
    title: "Dashboard + battery selector",
    summary: "Battery-focused dashboard plus TOOLS script to pick active pack / cell count.",
    layoutNotes:
      "Dashboard highlights voltage, mAh, C%, cell voltage. Companion tools/batt_select.lua for pack presets stored via model settings or Global variables.",
    companionScripts:
      "tools/batt_select.lua (SCRIPTS/TOOLS). Dashboard reads selected pack from getValue(source) or persistent flag.",
  },
};

const CARD_GRID_ARCHETYPES = new Set<LayoutArchetypeId>(["card-grid", "heli-rotorflight"]);

export function usesCardGridRecipe(archetypeId: LayoutArchetypeId): boolean {
  return CARD_GRID_ARCHETYPES.has(archetypeId);
}

function hashPrompt(prompt: string, seed = 0): number {
  return hashString(`${prompt}:${seed}`);
}

function pickFromPool(pool: LayoutArchetypeId[], prompt: string, seed: number): LayoutArchetypeHint {
  const idx = hashPrompt(prompt, seed) % pool.length;
  return ARCHETYPES[pool[idx]];
}

export function suggestLayoutArchetype(
  userPrompt: string,
  protocol: TelemetryProtocol,
  seed = 0
): LayoutArchetypeHint {
  const p = userPrompt.toLowerCase();

  if (/logger|log viewer|flight log|blackbox|gpx|history|record flight/.test(p)) {
    return ARCHETYPES["flight-logger-suite"];
  }
  if (/battery select|pack select|cell count|mah preset|battery preset/.test(p)) {
    return ARCHETYPES["battery-tool-suite"];
  }
  if (/minimal|simple|single metric|one number|large voltage/.test(p)) {
    return ARCHETYPES["hero-minimal"];
  }
  if (/strip|column|per channel|side by side/.test(p)) {
    return ARCHETYPES["strip-board"];
  }
  if (/quad|whoop|fpv|freestyle/.test(p)) {
    return ARCHETYPES["quad-overview"];
  }
  if (/dense|everything|all sensors|data screen/.test(p)) {
    return ARCHETYPES["telemetry-dense"];
  }

  const heliKeywords = /heli|rotorflight|headspeed|goblin|logo|tail|dbk|hspd/.test(p);
  const explicitHeliBoard = /heli dashboard|dbk|rotorflight board/.test(p);

  if (protocol === "rotorflight" && (heliKeywords || explicitHeliBoard)) {
    if (/vibrant|colorful|colourful|neon|bright|bold color|saturated|lively/.test(p)) {
      const vibrantHeli: LayoutArchetypeId[] = ["strip-board", "hero-minimal", "telemetry-dense"];
      const idx = hashPrompt(userPrompt, seed) % vibrantHeli.length;
      return {
        ...ARCHETYPES[vibrantHeli[idx]],
        layoutNotes:
          ARCHETYPES[vibrantHeli[idx]].layoutNotes +
          " Heli/rotorflight metrics (HSpd, RPM, EscT, MotT, RQLY) but with **vibrant accent colors**, colored borders, and asymmetric layout — not the default grey two-card DBK grid.",
      };
    }
    return ARCHETYPES["heli-rotorflight"];
  }

  if (protocol === "rotorflight") {
    const rotorflightPool: LayoutArchetypeId[] = [
      "strip-board",
      "hero-minimal",
      "telemetry-dense",
      "card-grid",
      "heli-rotorflight",
    ];
    return pickFromPool(rotorflightPool, userPrompt, seed);
  }

  const fallbacks: LayoutArchetypeId[] = [
    "card-grid",
    "strip-board",
    "hero-minimal",
    "telemetry-dense",
    "quad-overview",
  ];
  return pickFromPool(fallbacks, userPrompt, seed);
}

export function readLayoutArchetypesGuide(): string {
  return Object.values(ARCHETYPES)
    .map(
      (a) =>
        `### ${a.title} (\`${a.id}\`)\n${a.summary}\n${a.layoutNotes}${
          a.companionScripts ? `\nCompanion: ${a.companionScripts}` : ""
        }`
    )
    .join("\n\n");
}

export const EXAMPLE_BY_ARCHETYPE: Record<LayoutArchetypeId, string> = {
  "card-grid": "tx15-minimal-dashboard.lua",
  "heli-rotorflight": "tx15-rotorflight-heli.lua",
  "hero-minimal": "tx15-hero-minimal.lua",
  "strip-board": "tx15-strip-board.lua",
  "telemetry-dense": "tx15-telemetry-dense.lua",
  "quad-overview": "tx15-bfdash8f-whoop-dashboard.lua",
  "flight-logger-suite": "tx15-minimal-dashboard.lua",
  "battery-tool-suite": "tx15-minimal-dashboard.lua",
};

const NON_CARD_STARTER_ARCHETYPES = new Set<LayoutArchetypeId>([
  "hero-minimal",
  "strip-board",
  "telemetry-dense",
  "quad-overview",
]);

export function shouldIncludeCardStarter(archetypeId: LayoutArchetypeId): boolean {
  return !NON_CARD_STARTER_ARCHETYPES.has(archetypeId);
}
