import { readFileSync } from "node:fs";

import type { RadioProfile, TelemetryCatalog, TelemetryProtocol } from "@widget-gen/shared";

import {

  getRepoRoot,

  readRules,

  readTemplate,

  readDesignGuide,

  readRotorflightStyleGuide,

  readCompanionScriptsGuide,

} from "./knowledge.js";

import { suggestLayoutArchetype } from "./layoutArchetype.js";
import { detectVisualStyle } from "./visualStyle.js";



export function buildGenerationPrompt(

  userPrompt: string,

  radio: RadioProfile,

  catalog: TelemetryCatalog,

  edgeTxVersion?: string

): string {

  const rules = readRules();

  const designGuide = readDesignGuide(radio.id);

  const rotorflightGuide =

    catalog.protocol === "rotorflight" ? readRotorflightStyleGuide() : "";

  const companionGuide = readCompanionScriptsGuide();

  const archetype = suggestLayoutArchetype(userPrompt, catalog.protocol);
  const visualStyle = detectVisualStyle(userPrompt);

  const starter = readTemplate("dashboard-starter.lua");

  const exampleFile =

    catalog.protocol === "rotorflight"

      ? "tx15-rotorflight-heli.lua"

      : "tx15-minimal-dashboard.lua";

  const example = readFileSync(`${getRepoRoot()}/examples/${exampleFile}`, "utf-8");



  return `You are generating an EdgeTX Lua **full-screen dashboard** (widget script) for ${radio.name}.



Primary goal: a **clean, modern, readable** dashboard tailored to the user's request — not a copy of a fixed template.



## User request (follow this closely — layout and metrics must reflect it)

${userPrompt}



## Recommended layout archetype for this request

**${archetype.title}** (\`${archetype.id}\`)

${archetype.summary}



Layout direction:

${archetype.layoutNotes}

${archetype.companionScripts ? `\nCompanion scripts expected:\n${archetype.companionScripts}` : ""}

${visualStyle.promptNotes ? `\n${visualStyle.promptNotes}\n` : ""}

**Variety rule:** Do NOT default to the same two-column grey card grid unless the user explicitly asked for it or the archetype is \`card-grid\`. Different prompts must produce visibly different layouts and color treatments.



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

${rotorflightGuide ? `\n## Rotorflight heli patterns (DBK / TX15 community reference)\n${rotorflightGuide}` : ""}



## Companion scripts (when user asks for tools, loggers, selectors)

${companionGuide}



## Hard rules

${rules}



## Starter template (structural reference only — adapt layout to archetype + user request)

\`\`\`lua

${starter}

\`\`\`



## Quality reference (spacing/typography bar — do not clone layout unless archetype matches)

${visualStyle.vibrant ? "For this request, treat the example as **typography/spacing reference only** — use a different layout and vibrant colors.\n\n" : ""}

\`\`\`lua

${example}

\`\`\`



## Your tasks

1. Choose a dashboard name (max 10 chars, no spaces) that fits the use case.

2. Write the main dashboard to \`generated/<Name>/main.lua\`.

3. If the user requested battery selection, flight logging, log viewing, or similar: add companion scripts under \`generated/<Name>/tools/\` and/or \`generated/<Name>/telemetry/\` per the companion-scripts guide.

4. Start main.lua with edgetx-dev-kit annotations:

   \`\`\`lua

   ---@type WidgetScript

   ---@simulate Layout1x1 zone=0

   \`\`\`

5. Build UI for archetype **${archetype.id}**:

   - Cache ALL display strings as locals before drawText

   - Put all \`lcd.drawText\`, \`lcd.drawFilledRectangle\`, and \`lcd.drawRectangle\` calls **directly in refresh()** (web preview parses these)

   - Use LCD_W and LCD_H on ${radio.name} (${radio.lcdW}x${radio.lcdH})

6. Cache telemetry with getSourceIndex() in create().

7. Call validateWidget with dashboard name, protocol "${catalog.protocol}", and radioId "${radio.id}". Fix ALL errors AND visual-design warnings until valid: true.

8. Only after valid: true, call writeInstallGuide (radioId "${radio.id}") — INSTALL.md must document the dashboard **and every companion script** with SD card paths.

9. Only after valid: true, call packageWidget (radioId "${radio.id}") — zip includes WIDGETS/ and SCRIPTS/ paths.

10. Summarize in markdown: chosen archetype, layout sections, sensors used, companion scripts (if any), and condensed install steps from INSTALL.md.`;

}



export function buildRefinePrompt(

  userPrompt: string,

  widgetName?: string,

  radioId = "tx15",

  protocol?: TelemetryProtocol

): string {

  const designGuide = readDesignGuide(radioId);

  const rotorflightGuide = protocol === "rotorflight" ? readRotorflightStyleGuide() : "";

  const companionGuide = readCompanionScriptsGuide();

  const archetype = suggestLayoutArchetype(userPrompt, protocol ?? "generic-crsf");
  const visualStyle = detectVisualStyle(userPrompt);

  return `Refine the existing EdgeTX dashboard${widgetName ? ` "${widgetName}"` : ""}.



## User refinement request

${userPrompt}

${visualStyle.promptNotes ? `\n${visualStyle.promptNotes}\n` : ""}



## Layout direction (if refinement changes structure)

**${archetype.title}** — ${archetype.summary}



## Visual design standards

${designGuide}

${rotorflightGuide ? `\n## Rotorflight heli patterns (DBK reference)\n${rotorflightGuide}` : ""}



## Companion scripts

${companionGuide}



Keep the dashboard clean and distinct from generic templates. All lcd.* draws must stay directly in refresh().



## Tasks

1. Edit files under generated/ as needed (main.lua + any tools/telemetry companions).

2. Run validateWidget with protocol and radioId until valid: true. Fix visual-design warnings too.

3. Only after valid: true, run writeInstallGuide (must list all files + install steps) and packageWidget again.

4. Summarize changes made, including install instructions for any new companion scripts.`;

}


