/** EdgeTX 2.11 literal color globals (stubs/2.11/edgetx.constants.d.lua). */
export const EDGE_TX_LITERAL_COLORS = new Set([
  "BLACK",
  "BLUE",
  "BRIGHTGREEN",
  "CUSTOM_COLOR",
  "DARKBLUE",
  "DARKBROWN",
  "DARKGREEN",
  "DARKGREY",
  "DARKRED",
  "GREEN",
  "GREY",
  "GREY_DEFAULT",
  "LIGHTBROWN",
  "LIGHTGREY",
  "LIGHTWHITE",
  "ORANGE",
  "RED",
  "WHITE",
  "YELLOW",
]);

/**
 * Color names the web preview understands but EdgeTX radio Lua does not define.
 * Using them in `SMLSIZE + LIME` etc. crashes refresh() with nil arithmetic.
 */
export const PREVIEW_ONLY_COLOR_NAMES = ["LIME", "CYAN", "MAGENTA", "GRAY", "LIGHTRED"] as const;

export type PreviewOnlyColorName = (typeof PREVIEW_ONLY_COLOR_NAMES)[number];

export const PREVIEW_ONLY_COLOR_HINTS: Record<PreviewOnlyColorName, string> = {
  LIME: "BRIGHTGREEN or lcd.RGB(136, 255, 0) stored in create()",
  CYAN: "lcd.RGB(0, 210, 255) stored in create() as C_ACCENT",
  MAGENTA: "lcd.RGB(255, 80, 200) stored in create() as C_HERO",
  GRAY: "GREY",
  LIGHTRED: "RED or lcd.RGB(255, 102, 102) stored in create()",
};

export function stripLuaComments(source: string): string {
  return source.replace(/--[^\n]*/g, "");
}
