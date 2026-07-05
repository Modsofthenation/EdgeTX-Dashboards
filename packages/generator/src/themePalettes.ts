/** Curated EdgeTX dashboard palettes — injected into creative briefs and prompts. */

export interface DashboardPalette {
  id: string;
  name: string;
  accents: [string, string, string];
  background: string;
  surface: string;
  hero: string;
  label: string;
  headerStyle: string;
  borderStyle: string;
  /** Optional lcd.RGB locals to suggest in create() */
  rgbSetup?: string;
}

export const DASHBOARD_PALETTES: DashboardPalette[] = [
  {
    id: "edge-dark-cyan",
    name: "Edge Dark Cyan",
    accents: ["CYAN", "WHITE", "GREEN"],
    background: "BLACK or lcd.RGB(14,16,22)",
    surface: "DARKGREY + CYAN border",
    hero: "CYAN",
    label: "GREY",
    headerStyle: "DARKGREY header bar with 4px CYAN accent stripe",
    borderStyle: "CYAN card borders, WHITE secondary values",
    rgbSetup: "C_BG=lcd.RGB(14,16,22), C_CARD=lcd.RGB(36,40,52), C_ACCENT=lcd.RGB(0,200,255)",
  },
  {
    id: "edge-dark-lime",
    name: "Edge Dark Lime",
    accents: ["LIME", "YELLOW", "CYAN"],
    background: "BLACK",
    surface: "DARKGREY + LIME top stripe",
    hero: "LIME",
    label: "GREY",
    headerStyle: "BLACK header, LIME title text",
    borderStyle: "LIME borders, YELLOW hero on battery sections",
  },
  {
    id: "warm-cockpit",
    name: "Warm Cockpit",
    accents: ["ORANGE", "YELLOW", "GREEN"],
    background: "lcd.RGB(20,14,10)",
    surface: "lcd.RGB(40,28,20) + ORANGE border",
    hero: "YELLOW",
    label: "LIGHTGREY",
    headerStyle: "ORANGE 4px stripe under header",
    borderStyle: "ORANGE card borders, GREEN link OK",
    rgbSetup: "C_BG=lcd.RGB(20,14,10), C_CARD=lcd.RGB(40,28,20), C_ACCENT=lcd.RGB(255,140,40)",
  },
  {
    id: "rotor-neon",
    name: "Rotor Neon",
    accents: ["MAGENTA", "CYAN", "ORANGE"],
    background: "BLACK",
    surface: "lcd.RGB(28,20,40) + MAGENTA border",
    hero: "MAGENTA",
    label: "GREY",
    headerStyle: "MAGENTA title on dark header",
    borderStyle: "MAGENTA dividers, CYAN headspeed hero",
    rgbSetup: "C_BG=lcd.RGB(16,12,24), C_CARD=lcd.RGB(28,20,40), C_HERO=lcd.RGB(255,80,200)",
  },
  {
    id: "light-surface",
    name: "Light Surface",
    accents: ["DARKBLUE", "DARKGREEN", "DARKRED"],
    background: "LIGHTGREY or lcd.RGB(220,224,232)",
    surface: "WHITE fill + GREY border",
    hero: "DARKBLUE",
    label: "BLACK",
    headerStyle: "WHITE header bar, DARKBLUE title (BLACK text on light panels)",
    borderStyle: "GREY borders; never WHITE text on light cards",
    rgbSetup: "C_BG=lcd.RGB(220,224,232), C_CARD=lcd.RGB(255,255,255), C_TEXT=lcd.RGB(24,28,36)",
  },
  {
    id: "magenta-orange",
    name: "Magenta / Orange",
    accents: ["MAGENTA", "ORANGE", "YELLOW"],
    background: "BLACK",
    surface: "DARKGREY + MAGENTA border",
    hero: "ORANGE",
    label: "GREY",
    headerStyle: "Colored title text in MAGENTA on dark header",
    borderStyle: "MAGENTA dividers, ORANGE status chips",
  },
  {
    id: "yellow-cyan",
    name: "Yellow / Cyan",
    accents: ["YELLOW", "CYAN", "GREEN"],
    background: "BLACK",
    surface: "DARKGREY + CYAN border",
    hero: "YELLOW",
    label: "GREY",
    headerStyle: "YELLOW title, CYAN footer accents",
    borderStyle: "YELLOW hero, CYAN secondary metrics",
  },
  {
    id: "muted-teal",
    name: "Muted Teal",
    accents: ["CYAN", "GREEN", "WHITE"],
    background: "BLACK",
    surface: "DARKGREY + subtle CYAN border",
    hero: "CYAN",
    label: "GREY",
    headerStyle: "Subtle CYAN header line, mostly GREY structure",
    borderStyle: "CYAN at 50% visual weight on borders",
  },
  {
    id: "stealth-grey",
    name: "Stealth Grey",
    accents: ["GREY", "WHITE", "GREEN"],
    background: "BLACK",
    surface: "DARKGREY + GREY border",
    hero: "GREEN",
    label: "GREY",
    headerStyle: "Flat GREY header bar, single GREEN accent metric",
    borderStyle: "GREY borders with one GREEN highlight only",
  },
];

export function pickDashboardPalette(seed: number): DashboardPalette {
  return DASHBOARD_PALETTES[seed % DASHBOARD_PALETTES.length];
}

export function paletteMatchesLightRequest(paletteId: string): boolean {
  return paletteId === "light-surface";
}

/** Prefer light palette when user asks for white/light background. */
export function pickDashboardPaletteForPrompt(seed: number, userPrompt: string): DashboardPalette {
  if (/white\s+background|background\s+white|light\s+background|light\s+theme|light\s+mode|light\s+grey|lightgray|light\s+surface/i.test(userPrompt)) {
    return DASHBOARD_PALETTES.find((p) => p.id === "light-surface") ?? pickDashboardPalette(seed);
  }
  if (/vibrant|neon|colorful|colourful|magenta|lime|cyan accent/i.test(userPrompt)) {
    const vivid = ["edge-dark-lime", "rotor-neon", "magenta-orange", "yellow-cyan"];
    return DASHBOARD_PALETTES.find((p) => p.id === vivid[seed % vivid.length]) ?? pickDashboardPalette(seed);
  }
  return pickDashboardPalette(seed);
}

/** When the user names concrete colors, emit mandatory override notes for the agent. */
export function buildExplicitColorDirective(userPrompt: string): string | null {
  const p = userPrompt.toLowerCase();
  const wantsWhiteBg = /white\s+background|background\s+white|light\s+background/.test(p);
  const wantsRedBorder = /red\s+border/.test(p);
  const wantsBlackText = /black\s+text/.test(p);
  const wantsCustomRgb = /lcd\.rgb\s*\(/i.test(userPrompt);

  if (!wantsWhiteBg && !wantsRedBorder && !wantsBlackText && !wantsCustomRgb) {
    return null;
  }

  const lines = [
    "## Explicit color directive (user request — overrides palette / prior styling)",
    "Apply these colors **everywhere** (background, cards, borders, labels, values). Do not keep dark-theme GREY/DARKGREY if the user asked for light panels.",
    "",
  ];

  if (wantsWhiteBg) {
    lines.push(
      "- **Background & cards:** `C_BG = lcd.RGB(255,255,255)`, `C_CARD = lcd.RGB(255,255,255)` in `create()`, then `lcd.clear(C_BG)` and use `C_CARD` for header/footer/card fills."
    );
  }
  if (wantsRedBorder) {
    lines.push(
      "- **Borders:** `C_BORDER = lcd.RGB(200,32,32)` (or RED) on **every** `lcd.drawRectangle` for header, footer, and cards — not GREY or BLACK."
    );
  }
  if (wantsBlackText) {
    lines.push(
      "- **Text:** `C_TEXT = lcd.RGB(0,0,0)` and use `BLACK` / `C_TEXT` for labels and values on light cards — never WHITE or LIGHTGREY on white panels."
    );
  }
  if (wantsCustomRgb) {
    lines.push("- Honor any `lcd.RGB(r,g,b)` values the user specified literally in create().");
  }

  lines.push(
    "",
    "- Store colors on the widget in `create()` (`C_BG`, `C_CARD`, `C_BORDER`, `C_TEXT`, …) and assign `local C_* = widget.C_*` at the top of `refresh()`.",
    "- The web preview reads `lcd.RGB()` assignments in create() — use them instead of only named flags like GREY/DARKGREY when the user asked custom colors."
  );

  return lines.join("\n");
}
