import { COLOR_MAP, type EdgeColor } from "@widget-gen/layout-verify";

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
