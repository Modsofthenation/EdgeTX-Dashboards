/**
 * EdgeTX color-LCD (std / 480×*) LVGL font metrics — EdgeTX 2.11
 * `radio/src/fonts/lvgl/std/lv_font_en_*.c` line_height + mean advances.
 *
 * Lua flag → FontIndex (api_general.cpp):
 *   SMLSIZE→XS, MIDSIZE→L, DBLSIZE→XL, XXLSIZE→XXL, BOLD→bold_STD, 0→STD
 *
 * Selection outlines and approximate preview use these LCD metrics so boxes
 * track WASM/radio glyphs. Overlap checks use {@link layoutBudgetTextSize}
 * (LH/CW recipe constants) so stacked fields laid out with LH.SML=12 etc.
 * are not false-flagged.
 */

export const COLOR_LCD_FONT_SIZES = {
  TINSIZE: 12,
  SMLSIZE: 17,
  /** BOLD is its own size on color LCDs — not combinable with SML/MID/DBL. */
  BOLD: 20,
  /** Default / STDSIZE (no size flag). */
  STDSIZE: 21,
  MIDSIZE: 29,
  DBLSIZE: 40,
  XXLSIZE: 69,
} as const;

/** Mean horizontal advance (px/char). Slightly upper-biased so outlines enclose labels. */
const CHAR_W: Record<number, number> = {
  [COLOR_LCD_FONT_SIZES.TINSIZE]: 6,
  [COLOR_LCD_FONT_SIZES.SMLSIZE]: 8,
  [COLOR_LCD_FONT_SIZES.BOLD]: 10,
  [COLOR_LCD_FONT_SIZES.STDSIZE]: 10,
  [COLOR_LCD_FONT_SIZES.MIDSIZE]: 15,
  [COLOR_LCD_FONT_SIZES.DBLSIZE]: 20,
  [COLOR_LCD_FONT_SIZES.XXLSIZE]: 39,
};

/**
 * Generator / design-doc layout budget (LH + CW in tx15-text-layout.md).
 * Maps LCD line heights back to the denser stacking constants widgets use.
 */
const LAYOUT_BUDGET: Record<number, { h: number; cw: number }> = {
  [COLOR_LCD_FONT_SIZES.TINSIZE]: { h: 12, cw: 6 },
  [COLOR_LCD_FONT_SIZES.SMLSIZE]: { h: 12, cw: 6 },
  [COLOR_LCD_FONT_SIZES.BOLD]: { h: 18, cw: 9 },
  [COLOR_LCD_FONT_SIZES.STDSIZE]: { h: 18, cw: 9 },
  [COLOR_LCD_FONT_SIZES.MIDSIZE]: { h: 18, cw: 9 },
  [COLOR_LCD_FONT_SIZES.DBLSIZE]: { h: 26, cw: 12 },
  [COLOR_LCD_FONT_SIZES.XXLSIZE]: { h: 26, cw: 12 },
  // Legacy fixture aliases (distinct from COLOR_LCD_FONT_SIZES values)
  10: { h: 12, cw: 6 },
  14: { h: 18, cw: 9 },
};

/** EdgeTX fixed advance for a resolved font pixel height. */
export function edgeTxCharWidth(fontSize: number): number {
  return CHAR_W[fontSize] ?? Math.max(1, Math.round(fontSize * 0.5));
}

/** EdgeTX text footprint used by the editor selection overlay and preview. */
export function edgeTxTextSize(
  text: string,
  fontSize: number,
): { w: number; h: number } {
  return {
    w: Math.max(1, text.length * edgeTxCharWidth(fontSize)),
    h: fontSize,
  };
}

/**
 * Denser footprint matching LH/CW layout recipes — for static overlap checks
 * against widgets stacked with `LH.SML=12` / `LH.MID=18` / `LH.DBL=26`.
 */
export function layoutBudgetTextSize(
  text: string,
  fontSize: number,
): { w: number; h: number } {
  const budget = LAYOUT_BUDGET[fontSize] ?? {
    h: fontSize,
    cw: Math.max(1, Math.round(fontSize * 0.5)),
  };
  return {
    w: Math.max(1, text.length * budget.cw),
    h: budget.h,
  };
}

export type TextSizeFlagName =
  "SMLSIZE" | "MIDSIZE" | "DBLSIZE" | "XXLSIZE" | "BOLD" | "TINSIZE";

/** Map a draw-record fontSize (px) back to the nearest Lua size flag. */
export function fontSizeToFlag(fontSize: number): TextSizeFlagName {
  // Midpoints between COLOR_LCD_FONT_SIZES entries (ignore BOLD/STD for editor UI).
  if (fontSize >= 55) return "XXLSIZE";
  if (fontSize >= 35) return "DBLSIZE";
  if (fontSize >= 23) return "MIDSIZE";
  return "SMLSIZE";
}

/** Resolve lcd.drawText size flags to LVGL line height (px). */
export function resolveFontSize(flags: string): number {
  if (flags.includes("XXLSIZE")) return COLOR_LCD_FONT_SIZES.XXLSIZE;
  if (flags.includes("DBLSIZE")) return COLOR_LCD_FONT_SIZES.DBLSIZE;
  if (flags.includes("MIDSIZE")) return COLOR_LCD_FONT_SIZES.MIDSIZE;
  if (flags.includes("BOLD")) return COLOR_LCD_FONT_SIZES.BOLD;
  if (flags.includes("SMLSIZE")) return COLOR_LCD_FONT_SIZES.SMLSIZE;
  if (flags.includes("TINSIZE")) return COLOR_LCD_FONT_SIZES.TINSIZE;
  return COLOR_LCD_FONT_SIZES.STDSIZE;
}
