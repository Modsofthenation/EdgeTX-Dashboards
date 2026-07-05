import type { RadioProfile, TelemetryCatalog, TelemetryProtocol } from "@widget-gen/shared";

import {
  readRules,
  readTemplate,
  readDesignGuideForArchetype,
  readRotorflightStyleGuide,
  readCompanionScriptsGuide,
  readExampleSnippet,
} from "./knowledge.js";
import {
  suggestLayoutArchetype,
  readLayoutArchetypesGuide,
  EXAMPLE_BY_ARCHETYPE,
  shouldIncludeCardStarter,
  type LayoutArchetypeId,
} from "./layoutArchetype.js";
import { detectVisualStyle } from "./visualStyle.js";
import {
  buildCreativeBrief,
  deriveVariationSeed,
} from "./designVariation.js";
import { setActiveLayoutArchetype } from "./variationContext.js";

export interface PromptBuildContext {
  sessionId: string;
  runIndex?: number;
  variationSeed?: number;
}

function resolveVariation(ctx: PromptBuildContext): number {
  if (ctx.variationSeed !== undefined) return ctx.variationSeed;
  return deriveVariationSeed(ctx.sessionId, ctx.runIndex ?? 0);
}

export function buildGenerationPrompt(
  userPrompt: string,
  radio: RadioProfile,
  catalog: TelemetryCatalog,
  edgeTxVersion?: string,
  ctx?: PromptBuildContext
): string {
  const sessionId = ctx?.sessionId ?? "default";
  const runIndex = ctx?.runIndex ?? 0;
  const seed = resolveVariation({ sessionId, runIndex, variationSeed: ctx?.variationSeed });

  const archetype = suggestLayoutArchetype(userPrompt, catalog.protocol, seed);
  setActiveLayoutArchetype(archetype.id);

  const visualStyle = detectVisualStyle(userPrompt, seed);
  const brief = buildCreativeBrief(seed, archetype, catalog.protocol, userPrompt);
  const designGuide = readDesignGuideForArchetype(radio.id, archetype.id);
  const archetypeMenu = readLayoutArchetypesGuide();
  const rotorflightGuide =
    archetype.id === "heli-rotorflight" ? readRotorflightStyleGuide() : "";
  const companionGuide = readCompanionScriptsGuide();
  const rules = readRules();

  const exampleFile = EXAMPLE_BY_ARCHETYPE[archetype.id];
  const exampleSnippet = readExampleSnippet(exampleFile);

  const starterSection = shouldIncludeCardStarter(archetype.id)
    ? `\n## Starter template (card layout reference — vary metrics and proportions per creative brief)\n\n\`\`\`lua\n${readTemplate("dashboard-starter.lua")}\n\`\`\`\n`
    : "";

  const exampleSection = exampleSnippet
    ? `\n## API / typography snippet (do NOT copy coordinates or layout)\n\n\`\`\`lua\n${exampleSnippet}\n\`\`\`\n`
    : "";

  return `You are generating an EdgeTX Lua **full-screen dashboard** (widget script) for ${radio.name}.

Primary goal: a **clean, modern, readable** dashboard tailored to the user's request — not a copy of a fixed template.

## User request (follow this closely — layout and metrics must reflect it)

${userPrompt}

## Recommended layout archetype (suggested default — switch if user intent fits another)

**${archetype.title}** (\`${archetype.id}\`)

${archetype.summary}

Layout direction:

${archetype.layoutNotes}

${archetype.companionScripts ? `\nCompanion scripts expected:\n${archetype.companionScripts}` : ""}

${brief.markdown}

${visualStyle.promptNotes ? `\n${visualStyle.promptNotes}\n` : ""}

**Variety rule:** Do NOT default to the same two-column grey card grid unless the user explicitly asked for it or the archetype is \`card-grid\`. Different prompts and run seeds must produce visibly different layouts and color treatments.

## Layout archetype menu (pick the best fit for the user request)

${archetypeMenu}

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

${rotorflightGuide ? `\n## Rotorflight telemetry idioms (RQLY, zero handling — layout governed by creative brief + archetype)\n${rotorflightGuide}` : ""}

## Companion scripts (when user asks for tools, loggers, selectors)

${companionGuide}

## Hard rules

${rules}
${starterSection}${exampleSection}

## Your tasks

1. Choose a dashboard name (max 10 chars, no spaces) that fits the use case.

2. Write the main dashboard to \`generated/<Name>/main.lua\`.

3. If the user requested battery selection, flight logging, log viewing, or similar: add companion scripts under \`generated/<Name>/tools/\` and/or \`generated/<Name>/telemetry/\` per the companion-scripts guide.

4. Start main.lua with edgetx-dev-kit annotations:

   \`\`\`lua
   ---@type WidgetScript
   ---@simulate Layout1x1 zone=0
   \`\`\`

5. Build UI for archetype **${archetype.id}** per the creative brief:

   - Cache ALL display strings as locals before drawText
   - Put all \`lcd.drawText\`, \`lcd.drawFilledRectangle\`, and \`lcd.drawRectangle\` calls **directly in refresh()** (web preview parses these)
   - Use LCD_W and LCD_H on ${radio.name} (${radio.lcdW}x${radio.lcdH})

6. Cache telemetry with getSourceIndex() in create().

7. Call validateWidget with dashboard name, protocol "${catalog.protocol}", radioId "${radio.id}", and layoutArchetype "${archetype.id}". Fix ALL errors and **archetype-relevant** visual-design warnings until valid: true.

8. Only after valid: true, call writeInstallGuide (radioId "${radio.id}") — INSTALL.md must document the dashboard **and every companion script** with SD card paths.

9. Only after valid: true, call packageWidget (radioId "${radio.id}") — zip includes WIDGETS/ and SCRIPTS/ paths.

10. Summarize in markdown: chosen archetype, creative brief choices, layout sections, sensors used, companion scripts (if any), and condensed install steps from INSTALL.md.`;
}

export function buildRefinePrompt(
  userPrompt: string,
  widgetName?: string,
  radioId = "tx15",
  protocol?: TelemetryProtocol,
  ctx?: PromptBuildContext
): string {
  const sessionId = ctx?.sessionId ?? "default";
  const runIndex = ctx?.runIndex ?? 0;
  const seed = resolveVariation({ sessionId, runIndex, variationSeed: ctx?.variationSeed });

  const archetype = suggestLayoutArchetype(userPrompt, protocol ?? "generic-crsf", seed);
  setActiveLayoutArchetype(archetype.id);

  const visualStyle = detectVisualStyle(userPrompt, seed);
  const brief = buildCreativeBrief(seed, archetype, protocol ?? "generic-crsf", userPrompt);
  const designGuide = readDesignGuideForArchetype(radioId, archetype.id);
  const rotorflightGuide =
    archetype.id === "heli-rotorflight" ? readRotorflightStyleGuide() : "";
  const companionGuide = readCompanionScriptsGuide();

  return `Refine the existing EdgeTX dashboard${widgetName ? ` "${widgetName}"` : ""}.

## User refinement request

${userPrompt}

${brief.markdown}

${visualStyle.promptNotes ? `\n${visualStyle.promptNotes}\n` : ""}

## Layout direction (if refinement changes structure)

**${archetype.title}** (\`${archetype.id}\`) — ${archetype.summary}

${archetype.layoutNotes}

## Visual design standards

${designGuide}

${rotorflightGuide ? `\n## Rotorflight telemetry idioms (layout governed by creative brief + archetype)\n${rotorflightGuide}` : ""}

## Companion scripts

${companionGuide}

Keep the dashboard clean and distinct from generic templates. All lcd.* draws must stay directly in refresh().

## Tasks

1. Edit files under generated/ as needed (main.lua + any tools/telemetry companions).

2. Run validateWidget with protocol, radioId, and layoutArchetype "${archetype.id}" until valid: true. Fix archetype-relevant visual-design warnings.

3. Only after valid: true, run writeInstallGuide (must list all files + install steps) and packageWidget again.

4. Summarize changes made, including install instructions for any new companion scripts.`;
}

export function resolvePromptContext(
  sessionId: string,
  runIndex = 0,
  variationSeed?: number
): PromptBuildContext {
  const seed = variationSeed ?? deriveVariationSeed(sessionId, runIndex);
  return { sessionId, runIndex, variationSeed: seed };
}

export function getArchetypeForSession(
  userPrompt: string,
  protocol: TelemetryProtocol,
  ctx: PromptBuildContext
): LayoutArchetypeId {
  const seed = resolveVariation(ctx);
  return suggestLayoutArchetype(userPrompt, protocol, seed).id;
}
