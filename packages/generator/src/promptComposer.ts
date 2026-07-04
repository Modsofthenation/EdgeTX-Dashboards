import { readFileSync } from "node:fs";
import type { RadioProfile, TelemetryCatalog } from "@widget-gen/shared";
import { getRepoRoot, readRules, readTemplate, readDesignGuide } from "./knowledge.js";

export function buildGenerationPrompt(
  userPrompt: string,
  radio: RadioProfile,
  catalog: TelemetryCatalog,
  edgeTxVersion?: string
): string {
  const rules = readRules();
  const designGuide = readDesignGuide(radio.id);
  const starter = readTemplate("dashboard-starter.lua");
  const example = readFileSync(
    `${getRepoRoot()}/examples/tx15-minimal-dashboard.lua`,
    "utf-8"
  );

  return `You are generating an EdgeTX Lua full-screen dashboard widget.

Primary goal: a **clean, modern, readable** TX15 dashboard — card-based layout, clear typography, dark theme. Not a cluttered debug screen.

## User request
${userPrompt}

## Target radio
${JSON.stringify(radio, null, 2)}

## Telemetry protocol: ${catalog.label}
Use ONLY sensor names from the ${catalog.protocol} catalog. Call listTelemetrySensors before writing telemetry code.

Setup notes:
${(catalog.setupNotes ?? []).map((n) => `- ${n}`).join("\n")}

## EdgeTX version target
${edgeTxVersion ?? radio.edgeTxMin}+

## Visual design (mandatory)
${designGuide}

## Hard rules
${rules}

## Starter template (extend this card-layout pattern)
\`\`\`lua
${starter}
\`\`\`

## Reference example (match this quality level)
\`\`\`lua
${example}
\`\`\`

## Your tasks
1. Choose a widget name (max 10 chars, no spaces) appropriate for the dashboard.
2. Write the complete widget to \`generated/<WidgetName>/main.lua\`.
3. Start the file with edgetx-dev-kit annotations:
   \`\`\`lua
   ---@type WidgetScript
   ---@simulate Layout1x1 zone=0
   \`\`\`
4. Build a **clean UI**: header bar, 2-column metric cards, optional GPS strip, footer for flight mode. Use 12px padding, DARKGREY cards on BLACK, semantic colors (GREEN link, YELLOW battery).
5. Use LCD_W and LCD_H on ${radio.name} (${radio.lcdW}x${radio.lcdH}). Put all \`lcd.drawText\`, \`lcd.drawFilledRectangle\`, and \`lcd.drawRectangle\` calls **directly in refresh()** (web preview parses these).
6. Cache telemetry with getSourceIndex() in create().
7. Call validateWidget with widget name, protocol "${catalog.protocol}", and radioId "${radio.id}". Fix ALL errors AND visual-design warnings until valid: true.
8. Only after valid: true, call writeInstallGuide (radioId "${radio.id}").
9. Only after valid: true, call packageWidget (radioId "${radio.id}").
10. Summarize layout sections and sensors used.`;
}

export function buildRefinePrompt(userPrompt: string, widgetName?: string): string {
  const designGuide = readDesignGuide("tx15");
  return `Refine the existing EdgeTX widget${widgetName ? ` "${widgetName}"` : ""}.

## User refinement request
${userPrompt}

## Visual design standards
${designGuide}

Keep the dashboard clean: card panels, 12px grid, label/value hierarchy, at most 2 accent colors. All lcd.* draws must stay directly in refresh().

## Tasks
1. Edit the widget source in generated/ as needed.
2. Run validateWidget with protocol and radioId until valid: true. Fix visual-design warnings too.
3. Only after valid: true, run writeInstallGuide and packageWidget again.
4. Summarize changes made.`;
}
