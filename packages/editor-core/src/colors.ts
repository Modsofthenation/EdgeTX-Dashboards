import { COLOR_MAP, type EdgeColor } from "@widget-gen/layout-verify";

/**
 * Preview-only names understood by the web canvas but not defined as EdgeTX
 * radio Lua globals. Using them in flag math crashes refresh() on device.
 */
export const PREVIEW_ONLY_COLOR_NAMES = [
  "LIME",
  "CYAN",
  "MAGENTA",
  "LIGHTRED",
] as const;

export type PreviewOnlyColorName = (typeof PREVIEW_ONLY_COLOR_NAMES)[number];

const PREVIEW_ONLY = new Set<string>(PREVIEW_ONLY_COLOR_NAMES);

/** Closest radio-safe literal when rewriting a preview-only color. */
export const PREVIEW_ONLY_TO_RADIO: Record<PreviewOnlyColorName, EdgeColor> = {
  LIME: "BRIGHTGREEN",
  CYAN: "BRIGHTGREEN",
  MAGENTA: "ORANGE",
  LIGHTRED: "RED",
};

const HEX_TO_EDGE = new Map<string, EdgeColor>();
for (const [name, hex] of Object.entries(COLOR_MAP)) {
  HEX_TO_EDGE.set(hex.toLowerCase(), name as EdgeColor);
}

/** Map a hex color from the interpreter to an EdgeTX color name. */
export function hexToEdgeColor(
  hex: string | undefined,
  fallback: EdgeColor = "WHITE",
): EdgeColor {
  if (!hex) return fallback;
  const normalized = hex.toLowerCase();
  return HEX_TO_EDGE.get(normalized) ?? fallback;
}

/** Map EdgeTX color name to hex for editor UI. */
export function edgeColorToHex(name: EdgeColor): string {
  return COLOR_MAP[name] ?? "#ffffff";
}

export const EDGE_COLOR_NAMES = Object.keys(COLOR_MAP) as EdgeColor[];

/** Colors safe to offer in Layout pickers and write into radio Lua. */
export const RADIO_SAFE_COLOR_NAMES = EDGE_COLOR_NAMES.filter(
  (name) => !PREVIEW_ONLY.has(name),
);

export function isPreviewOnlyColor(name: string): boolean {
  return PREVIEW_ONLY.has(name);
}

/** Coerce a color name (or hex-resolved name) to a radio-safe picker value. */
export function toRadioSafeColor(name: EdgeColor): EdgeColor {
  if (!isPreviewOnlyColor(name)) return name;
  return PREVIEW_ONLY_TO_RADIO[name as PreviewOnlyColorName] ?? "WHITE";
}

/**
 * Replace preview-only color globals in Lua with radio-safe literals.
 * Prefer widget.C_ACCENT / widget.C_HERO when those fields already exist.
 */
export function remapPreviewOnlyColorLiterals(source: string): {
  source: string;
  applied: string[];
} {
  const applied: string[] = [];
  let out = source;

  const hasAccent =
    /\bC_ACCENT\b/.test(out) || /\bwidget\.C_ACCENT\b/.test(out);
  const hasHero = /\bC_HERO\b/.test(out) || /\bwidget\.C_HERO\b/.test(out);

  if (/\bGRAY\b/.test(out)) {
    out = out.replace(/\bGRAY\b/g, "GREY");
    applied.push("GRAY→GREY");
  }
  if (/\bLIME\b/.test(out)) {
    out = out.replace(/\bLIME\b/g, "BRIGHTGREEN");
    applied.push("LIME→BRIGHTGREEN");
  }
  if (/\bLIGHTRED\b/.test(out)) {
    out = out.replace(/\bLIGHTRED\b/g, "RED");
    applied.push("LIGHTRED→RED");
  }
  if (/\bCYAN\b/.test(out)) {
    const replacement = hasAccent ? "widget.C_ACCENT" : "BRIGHTGREEN";
    out = out.replace(/\bCYAN\b/g, replacement);
    applied.push(`CYAN→${replacement}`);
  }
  if (/\bMAGENTA\b/.test(out)) {
    const replacement = hasHero ? "widget.C_HERO" : "ORANGE";
    out = out.replace(/\bMAGENTA\b/g, replacement);
    applied.push(`MAGENTA→${replacement}`);
  }

  return { source: out, applied };
}
