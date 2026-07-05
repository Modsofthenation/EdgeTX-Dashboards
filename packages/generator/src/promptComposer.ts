import type { RadioProfile, TelemetryCatalog, TelemetryProtocol } from "@widget-gen/shared";

import {
  readRules,
  readTemplate,
  readDesignGuideForArchetype,
  readRotorflightStyleGuide,
  readCompanionScriptsGuide,
  readModelImageGuide,
  readExampleSnippet,
  loadTelemetryCatalog,
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

function buildProtocolLockSection(catalog: TelemetryCatalog): string {
  const firmwareHint =
    catalog.protocol === "betaflight"
      ? "Do NOT use rotorflight-only sensors (HSpd, EscT, MotT) or label the UI/footer as \"Rotorflight\"."
      : catalog.protocol === "rotorflight"
        ? "Rotorflight motor sensors (HSpd, RPM, EscT, MotT) require rf2bg — see setup notes."
        : "Use only sensors listed for generic CRSF; do not assume betaflight or rotorflight names.";

  return `## Protocol lock (authoritative — UI selection overrides prompt text)

The user selected **${catalog.label}** (\`${catalog.protocol}\`) in the generator UI.

- Call \`listTelemetrySensors\` with protocol \`"${catalog.protocol}"\` before writing telemetry code.
- Use **only** sensor names from that catalog — validation rejects unknown sensors.
- If the user's prompt mentions another firmware (heli, rotorflight, betaflight, etc.), **ignore the firmware hint** and keep the selected protocol.
- ${firmwareHint}`;
}

function buildTelemetrySection(catalog: TelemetryCatalog): string {
  return `## Telemetry protocol: ${catalog.label}

${buildProtocolLockSection(catalog)}

Setup notes:

${(catalog.setupNotes ?? []).map((n) => `- ${n}`).join("\n")}`;
}

function wantsModelImage(userPrompt: string): boolean {
  return /model image|model photo|model picture|plane image|heli image|photo of (the )?model|show.*model.*(image|photo|picture)/i.test(
    userPrompt
  );
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
    catalog.protocol === "rotorflight" && archetype.id === "heli-rotorflight"
      ? readRotorflightStyleGuide()
      : "";
  const companionGuide = readCompanionScriptsGuide();
  const modelImageGuide = wantsModelImage(userPrompt) ? readModelImageGuide() : "";
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

## User request (layout and metrics — must still obey the selected protocol below)

${userPrompt}

${buildTelemetrySection(catalog)}

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

## EdgeTX version target

${edgeTxVersion ?? radio.edgeTxMin}+

## Visual design (mandatory)

${designGuide}

${rotorflightGuide ? `\n## Rotorflight telemetry idioms (RQLY, zero handling — layout governed by creative brief + archetype)\n${rotorflightGuide}` : ""}

## Companion scripts (when user asks for tools, loggers, selectors)

${companionGuide}

${modelImageGuide ? `\n## Model image (user requested — include ShowModel option + placeholder)\n${modelImageGuide}` : ""}

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

  const resolvedProtocol = protocol ?? "generic-crsf";
  const catalog = loadTelemetryCatalog(resolvedProtocol);

  const archetype = suggestLayoutArchetype(userPrompt, resolvedProtocol, seed);
  setActiveLayoutArchetype(archetype.id);

  const visualStyle = detectVisualStyle(userPrompt, seed);
  const brief = buildCreativeBrief(seed, archetype, resolvedProtocol, userPrompt);
  const designGuide = readDesignGuideForArchetype(radioId, archetype.id);
  const rotorflightGuide =
    resolvedProtocol === "rotorflight" && archetype.id === "heli-rotorflight"
      ? readRotorflightStyleGuide()
      : "";
  const companionGuide = readCompanionScriptsGuide();

  return `Refine the existing EdgeTX dashboard${widgetName ? ` "${widgetName}"` : ""}.

## User refinement request

${userPrompt}

${buildTelemetrySection(catalog)}

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

2. Run validateWidget with widgetName, protocol "${resolvedProtocol}", radioId "${radioId}", and layoutArchetype "${archetype.id}" until valid: true. Fix archetype-relevant visual-design warnings.

3. Only after valid: true, run writeInstallGuide with protocol "${resolvedProtocol}" (must list all files + install steps) and packageWidget with protocol "${resolvedProtocol}" again.

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
