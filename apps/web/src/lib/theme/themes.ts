export const THEME_IDS = [
  "light",
  "dark",
  "midnight",
  "slate",
  "forest",
  "ocean",
  "contrast",
  "graphite",
  "meadow",
  "fog",
  "ember",
  "volt",
  "copper",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const THEME_OPTIONS: {
  id: ThemeId;
  label: string;
  description: string;
}[] = [
  {
    id: "light",
    label: "Light",
    description: "Cool paper chrome with teal accents",
  },
  {
    id: "dark",
    label: "Dark",
    description: "Charcoal panels, bright teal accents",
  },
  {
    id: "midnight",
    label: "Midnight",
    description: "Deep navy workspace",
  },
  {
    id: "slate",
    label: "Slate",
    description: "Neutral gray tooling theme",
  },
  {
    id: "forest",
    label: "Forest",
    description: "Dark green instrument look",
  },
  {
    id: "ocean",
    label: "Ocean",
    description: "Light cyan workspace",
  },
  {
    id: "contrast",
    label: "High contrast",
    description: "Strong borders and text",
  },
  {
    id: "graphite",
    label: "Graphite",
    description: "Cool light gray workshop",
  },
  {
    id: "meadow",
    label: "Meadow",
    description: "Soft daylight green",
  },
  {
    id: "fog",
    label: "Fog",
    description: "Misty blue-gray bench",
  },
  {
    id: "ember",
    label: "Ember",
    description: "Dark panels with amber accents",
  },
  {
    id: "volt",
    label: "Volt",
    description: "Racing dark with electric lime",
  },
  {
    id: "copper",
    label: "Copper",
    description: "Warm bronze instrument chrome",
  },
];

export const THEME_STORAGE_KEY = "etx-dashboards-theme";
export const DEFAULT_THEME: ThemeId = "light";

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return THEME_IDS.includes(value as ThemeId);
}
