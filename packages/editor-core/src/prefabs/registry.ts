import type { PrefabCatalogEntry, PrefabSection } from "./types.ts";
import { BETAFLIGHT_QUAD_PREFABS } from "./betaflightQuadSections.ts";
import { ROTORFLIGHT_HELI_PREFABS } from "./rotorflightSections.ts";

const ALL_PREFABS: PrefabSection[] = [
  ...ROTORFLIGHT_HELI_PREFABS,
  ...BETAFLIGHT_QUAD_PREFABS,
];

const BY_ID = new Map<string, PrefabSection>(
  ALL_PREFABS.map((p) => [p.id, p]),
);

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

/** Markdown summary for AI prompts. */
export function formatPrefabCatalogForPrompt(protocol?: string): string {
  const items = listPrefabSections(
    protocol ? { protocol } : { protocol: "rotorflight" },
  );
  if (items.length === 0) return "";

  const familyHint =
    protocol === "betaflight" || protocol === "generic-crsf"
      ? "Use these modular sections when the user wants a Betaflight / CRSF quad layout on TX15."
      : "Use these modular sections when the user wants a Rotorflight heli layout on TX15.";

  const lines = [
    "### Prefab sections (compose dashboards from these blocks)",
    "",
    familyHint,
    "Each id maps to a tested lcd.* block — prefer composing from prefabs over inventing new geometry.",
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

  return lines.join("\n");
}
