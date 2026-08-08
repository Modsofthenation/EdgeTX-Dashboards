/** Detect user prompts that request rounded card/grid corners. */

export function wantsRoundedCorners(userPrompt: string): boolean {
  const p = userPrompt.toLowerCase();
  return (
    /rounded\s+corners?/.test(p) ||
    /round(?:ed)?\s+cards?/.test(p) ||
    /corner\s+radius/.test(p) ||
    /soft\s+corners?/.test(p) ||
    /rounded\s+(?:blocks?|panels?|tiles?|cells?|grid)/.test(p) ||
    /grid\s+.*\brounded\b/.test(p) ||
    /\brounded\b.*\bgrid\b/.test(p)
  );
}

export function buildRoundedCornersDirective(guideMarkdown: string): string {
  if (!guideMarkdown.trim()) {
    return [
      "## Rounded card panels (user request — mandatory)",
      "Use lcd.drawFilledCircle corner caps + inset drawFilledRectangle bars (cr=8).",
      "Keep all lcd.* calls directly in refresh() for web preview.",
    ].join("\n");
  }
  return `## Rounded card panels (user request — mandatory)\n\n${guideMarkdown.trim()}`;
}
