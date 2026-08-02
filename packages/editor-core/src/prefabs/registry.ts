import {
  DENSE_CRSF_LAYOUT_ORDER,
  FREESTYLE_LAYOUT_ORDER,
  MINIMAL_QUAD_LAYOUT_ORDER,
  WHOOP_LAYOUT_ORDER,
} from "./betaflightQuadSections.ts";
import type { PrefabCatalogEntry, PrefabSection } from "./types.ts";
import { BETAFLIGHT_QUAD_PREFABS } from "./betaflightQuadSections.ts";
import { ROTORFLIGHT_HELI_PREFABS } from "./rotorflightSections.ts";

const ALL_PREFABS: PrefabSection[] = [
  ...ROTORFLIGHT_HELI_PREFABS,
  ...BETAFLIGHT_QUAD_PREFABS,
];

const BY_ID = new Map<string, PrefabSection>(ALL_PREFABS.map((p) => [p.id, p]));

/** All registered prefab sections (editor + AI shared catalog). */
export function listPrefabSections(filter?: {
  protocol?: string;
  family?: string;
}): PrefabSection[] {
  return ALL_PREFABS.filter((p) => {
    if (filter?.family && p.family !== filter.family) return false;
    if (filter?.protocol) {
      if (p.protocol === "any") {
        // Shared BF/CRSF blocks — hide from Rotorflight heli menus.
        if (filter.protocol === "rotorflight") return false;
      } else if (p.protocol !== filter.protocol) {
        return false;
      }
    }
    return true;
  });
}

export function getPrefabSection(id: string): PrefabSection | undefined {
  return BY_ID.get(id);
}

/** Compact catalog for UI menus and prompt injection. */
export function listPrefabCatalog(filter?: {
  protocol?: string;
}): PrefabCatalogEntry[] {
  return listPrefabSections(filter).map((p) => ({
    id: p.id,
    label: p.label,
    shortLabel: p.shortLabel,
    description: p.description,
    category: p.category,
    protocol: p.protocol,
    requiredSensors: p.requiredSensors,
    telemetryNotes: p.telemetryNotes,
  }));
}

/** Canonical RF heli TX15 layout order (electric). */
export const ROTORFLIGHT_ELECTRIC_LAYOUT_ORDER = [
  "rf-topbar-link",
  "rf-model-panel",
  "rf-governor-card",
  "rf-headspeed-hero",
  "rf-motor-tiles",
  "rf-battery-bar",
] as const;

/** Nitro / OMP RF heli TX15 order — pack tiles + RX voltage bar. */
export const ROTORFLIGHT_NITRO_LAYOUT_ORDER = [
  "rf-topbar-link",
  "rf-model-panel",
  "rf-governor-card",
  "rf-headspeed-hero",
  "rf-nitro-pack-tiles",
  "rf-nitro-rx-bar",
] as const;

/** Canonical board recipes the agent / Layout Insert menus share. */
export function formatPrefabBoardRecipesForPrompt(protocol?: string): string {
  if (protocol === "rotorflight") {
    return [
      "### Canonical board recipes (compose with `composeWidgetFromPrefabs`)",
      "",
      `- **RF heli electric:** \`${ROTORFLIGHT_ELECTRIC_LAYOUT_ORDER.join("`, `")}\``,
      `- **RF heli nitro:** \`${ROTORFLIGHT_NITRO_LAYOUT_ORDER.join("`, `")}\``,
      "",
      "Call `composeWidgetFromPrefabs` with one of these orders first, then only tweak palette/labels.",
    ].join("\n");
  }
  if (protocol === "betaflight" || protocol === "generic-crsf") {
    return [
      "### Canonical board recipes (compose with `composeWidgetFromPrefabs`)",
      "",
      `- **Whoop / overview:** \`${WHOOP_LAYOUT_ORDER.join("`, `")}\``,
      `- **Freestyle:** \`${FREESTYLE_LAYOUT_ORDER.join("`, `")}\``,
      `- **Minimal quad:** \`${MINIMAL_QUAD_LAYOUT_ORDER.join("`, `")}\``,
      `- **Dense CRSF:** \`${DENSE_CRSF_LAYOUT_ORDER.join("`, `")}\``,
      "",
      "Call `composeWidgetFromPrefabs` with one of these orders first, then only tweak palette/labels.",
    ].join("\n");
  }
  return "";
}

/** Markdown summary for AI prompts. */
export function formatPrefabCatalogForPrompt(protocol?: string): string {
  const filterProtocol =
    protocol === "betaflight" ||
    protocol === "generic-crsf" ||
    protocol === "rotorflight"
      ? protocol
      : undefined;
  const items = listPrefabSections(
    filterProtocol ? { protocol: filterProtocol } : undefined,
  );
  if (items.length === 0) return "";

  const familyHint =
    protocol === "betaflight" || protocol === "generic-crsf"
      ? "Use these modular sections when the user wants a Betaflight / CRSF quad layout."
      : protocol === "rotorflight"
        ? "Use these modular sections when the user wants a Rotorflight heli layout."
        : "Use these modular sections to assemble dashboards (RF heli + Betaflight/CRSF quad).";

  const lines = [
    "### Prefab sections (compose dashboards from these blocks)",
    "",
    familyHint,
    "Each id maps to a tested lcd.* block — prefer composing from prefabs over inventing new geometry.",
    "Keep `-- prefab:<id>` markers so Layout Insert/edit stays coherent.",
    "",
  ];

  for (const p of items) {
    const sensors = [...p.requiredSensors, ...p.optionalSensors].join(", ");
    lines.push(
      `- **\`${p.id}\`** — ${p.label}: ${p.description}`,
      `  - Sensors: ${sensors || "(none)"}`,
    );
    for (const note of p.telemetryNotes.slice(0, 2)) {
      lines.push(`  - Note: ${note}`);
    }
  }

  const recipes = formatPrefabBoardRecipesForPrompt(protocol);
  if (recipes) {
    lines.push("", recipes);
  }

  return lines.join("\n");
}
