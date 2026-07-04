export interface VisualStyleHints {
  vibrant: boolean;
  colorEmphasis: boolean;
  promptNotes: string;
}

export function detectVisualStyle(userPrompt: string): VisualStyleHints {
  const p = userPrompt.toLowerCase();

  const vibrant =
    /vibrant|colorful|colourful|neon|bright|bold color|pop of color|saturated|lively|striking/.test(
      p
    );
  const colorEmphasis =
    vibrant ||
    /cyan|magenta|lime|orange accent|yellow accent|custom color|colour scheme|color scheme/.test(
      p
    );

  if (!colorEmphasis) {
    return { vibrant: false, colorEmphasis: false, promptNotes: "" };
  }

  const lines = [
    "## Color & style (user request — mandatory)",
    "The user asked for a **colorful / vibrant** dashboard. Do NOT ship a flat grey-only layout.",
    "- Use BOOL **ValueColor** and **TextColor** options; default to saturated colors (CYAN, LIME, MAGENTA, YELLOW, ORANGE) — not only GREY/DARKGREY/WHITE.",
    "- Card **borders** in accent colors (CYAN, MAGENTA, LIME, YELLOW) — not plain GREY rectangles on DARKGREY.",
    "- Header: dark fill plus a **4px accent stripe** (CYAN/LIME/MAGENTA) or colored title text — not a flat GREY bar.",
    "- Hero metric uses ValueColor (DBLSIZE); footer/status uses ORANGE/GREEN/YELLOW as appropriate.",
    "- Minimum **3 distinct accent colors** visible on screen at once.",
    "- If archetype is heli/rotorflight, still apply vibrant accents — do not clone the dull DBK grey card clone unless user said \"minimal\" or \"DBK\".",
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
