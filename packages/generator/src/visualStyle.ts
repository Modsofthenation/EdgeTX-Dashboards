export interface VisualStyleHints {
  vibrant: boolean;
  colorEmphasis: boolean;
  promptNotes: string;
}

const SUBTLE_PALETTE_NOTES = [
  "Use **CYAN + GREEN** accents on a dark background — one colored border or header stripe.",
  "Use **ORANGE + YELLOW** accents — warm battery/link highlights, GREY structure.",
  "Use **MAGENTA + CYAN** accents — colored title and one hero metric, rest GREY/WHITE.",
];

export function detectVisualStyle(userPrompt: string, seed = 0): VisualStyleHints {
  const p = userPrompt.toLowerCase();

  const lightTheme =
    /white\s+background|background\s+white|light\s+background|light\s+theme|black\s+text|red\s+border/.test(p);

  const vibrant =
    /vibrant|colorful|colourful|neon|bright|bold color|pop of color|saturated|lively|striking/.test(
      p
    );
  const colorEmphasis =
    vibrant ||
    lightTheme ||
    /cyan|magenta|lime|orange accent|yellow accent|custom color|colour scheme|color scheme/.test(
      p
    );

  if (lightTheme && !vibrant) {
    return {
      vibrant: false,
      colorEmphasis: true,
      promptNotes: [
        "## Light theme (user request — mandatory)",
        "The user asked for a **light** dashboard (white/light background, dark text, or colored borders).",
        "- Do NOT keep BLACK/DARKGREY backgrounds or WHITE text on dark cards.",
        "- Use lcd.RGB locals in create() for C_BG, C_CARD, C_BORDER, C_TEXT and wire them through refresh().",
        "- See the explicit color directive in the creative brief if present — it overrides the default palette.",
      ].join("\n"),
    };
  }

  if (colorEmphasis) {
    const lines = [
      "## Color & style (user request — mandatory)",
      "The user asked for a **colorful / vibrant** dashboard. Do NOT ship a flat grey-only layout.",
      "- Use BOOL **ValueColor** and **TextColor** options; default to saturated colors (CYAN, LIME, MAGENTA, YELLOW, ORANGE) — not only GREY/DARKGREY/WHITE.",
      "- Card **borders** in accent colors (CYAN, MAGENTA, LIME, YELLOW) — not plain GREY rectangles on DARKGREY.",
      "- Header: dark fill plus a **4px accent stripe** (CYAN/LIME/MAGENTA) or colored title text — not a flat GREY bar.",
      "- Hero metric uses ValueColor (DBLSIZE); footer/status uses ORANGE/GREEN/YELLOW as appropriate.",
      "- Minimum **3 distinct accent colors** visible on screen at once.",
      "- Do not clone the dull DBK grey card clone unless user said \"minimal\" or \"DBK\".",
    ];

    if (vibrant) {
      lines.push(
        "- Prefer **strip board**, **hero minimal with color bands**, or **asymmetric layout** over the default two-column grey card grid when it fits the prompt."
      );
    }

    return {
      vibrant,
      colorEmphasis: true,
      promptNotes: lines.join("\n"),
    };
  }

  const paletteNote = SUBTLE_PALETTE_NOTES[seed % SUBTLE_PALETTE_NOTES.length];
  return {
    vibrant: false,
    colorEmphasis: true,
    promptNotes: [
      "## Color palette (automatic variety for this run)",
      paletteNote,
      "Avoid an all-grey layout — include at least one accent color from the creative brief.",
    ].join("\n"),
  };
}
