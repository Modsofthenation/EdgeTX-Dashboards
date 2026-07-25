import { DEFAULT_RADIO_ID } from "@widget-gen/shared";

export interface RadioCatalogEntry {
  id: string;
  name: string;
  lcdW: number;
  lcdH: number;
  touch: boolean;
  layoutProfile: string;
  default?: boolean;
}

export interface RadioCatalog {
  defaultId: string;
  radios: RadioCatalogEntry[];
}

export { DEFAULT_RADIO_ID };

export async function fetchRadioCatalog(): Promise<RadioCatalog> {
  const res = await fetch("/api/radios");
  if (!res.ok) {
    return {
      defaultId: DEFAULT_RADIO_ID,
      radios: [
        {
          id: DEFAULT_RADIO_ID,
          name: "RadioMaster TX15",
          lcdW: 480,
          lcdH: 320,
          touch: true,
          layoutProfile: DEFAULT_RADIO_ID,
          default: true,
        },
      ],
    };
  }
  return (await res.json()) as RadioCatalog;
}

export function findRadio(
  catalog: RadioCatalog,
  radioId: string,
): RadioCatalogEntry | undefined {
  return catalog.radios.find((r) => r.id === radioId);
}

export function radioLabel(entry: RadioCatalogEntry): string {
  return `${entry.name} · ${entry.lcdW}×${entry.lcdH}`;
}

export const LAYOUT_GROUP_LABELS: Record<string, string> = {
  tx15: "480×320 · TX15",
  color272: "480×272 · Color Horus class",
  taranis212: "212×64 · Taranis",
  compact128: "128×64 · Compact",
};

export function groupRadiosByLayout(
  radios: RadioCatalogEntry[],
): Map<string, RadioCatalogEntry[]> {
  const groups = new Map<string, RadioCatalogEntry[]>();
  for (const radio of radios) {
    const list = groups.get(radio.layoutProfile) ?? [];
    list.push(radio);
    groups.set(radio.layoutProfile, list);
  }
  return groups;
}
