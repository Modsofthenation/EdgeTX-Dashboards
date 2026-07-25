import type { RadioProfile, TelemetryCatalog, TelemetryProtocol } from "@widget-gen/shared";

import {
  readRules,
  readTemplate,
  readDesignGuideForArchetype,
  readRotorflightStyleGuide,
  readCompanionScriptsGuide,
  readModelImageGuide,
  readModelHeroDashboardGuide,
  readTextLayoutGuide,
  readLayoutReservedRectsGuide,
  readRuntimeApiPitfallsGuide,
  readThemePalettesGuide,
  readExampleSnippet,
  readExampleSnippetForArchetype,
  readLayoutExampleSnippet,
  loadTelemetryCatalog,
  loadRadioProfile,
  readRoundedCornersGuide,
} from "./knowledge.ts";
import { wantsRoundedCorners } from "./roundedCorners.ts";
import {
  suggestLayoutArchetype,
  EXAMPLE_BY_ARCHETYPE,
  shouldIncludeCardStarter,
  type LayoutArchetypeId,
} from "./layoutArchetype.ts";
import { detectVisualStyle } from "./visualStyle.ts";
import {
  buildCreativeBrief,
  deriveVariationSeed,
} from "./designVariation.ts";
import { setActiveLayoutArchetype } from "./variationContext.ts";
import { buildReferenceImagesSection } from "./promptImages.ts";
import type { RefineHistorySections } from "./refineHistory.ts";

export interface PromptBuildContext {
  sessionId: string;
  runIndex?: number;
  variationSeed?: number;
  assignedWidgetName?: string;
  widgetInstanceId?: string;
  widgetVersion?: number;
  /** Number of reference images attached to the user message. */
  referenceImageCount?: number;
  /** Prior chat summary + design artifacts for refine prompts. */
  refineHistory?: RefineHistorySections;
}

function resolveVariation(ctx: PromptBuildContext): number {
  if (ctx.variationSeed !== undefined) return ctx.variationSeed;
  return deriveVariationSeed(ctx.sessionId, ctx.runIndex ?? 0);
}

function formatSensorCatalogInline(catalog: TelemetryCatalog): string {
  const byCategory = new Map<string, string[]>();
  for (const s of catalog.sensors) {
    const list = byCategory.get(s.category) ?? [];
    list.push(s.unit ? `${s.name} (${s.unit})` : s.name);
    byCategory.set(s.category, list);
  }
  return [...byCategory.entries()]
    .map(([cat, names]) => `- **${cat}:** ${names.join(", ")}`)
    .join("\n");
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

- Use **only** sensor names from the catalog below — validation rejects unknown sensors. Do **not** call \`listTelemetrySensors\` unless you need a filtered subset.
- If the user's prompt mentions another firmware (heli, rotorflight, betaflight, etc.), **ignore the firmware hint** and keep the selected protocol.
- ${firmwareHint}

### Allowed sensors (\`${catalog.protocol}\`)

${formatSensorCatalogInline(catalog)}`;
}

function buildTelemetrySection(catalog: TelemetryCatalog): string {
  return `## Telemetry protocol: ${catalog.label}

${buildProtocolLockSection(catalog)}

Setup notes:

${(catalog.setupNotes ?? []).map((n) => `- ${n}`).join("\n")}`;
}

function wantsModelImage(userPrompt: string): boolean {
  return /model image|model photo|model picture|plane image|heli image|photo of (the )?model|show.*model.*(image|photo|picture)|full[- ]?screen.*(image|photo|picture|png)|background.*(image|photo|picture|png)|image behind|opacity.*(filter|overlay).*(image|photo|model)|behind.*widget/i.test(
    userPrompt
  );
}

function wantsModelHeroDashboard(userPrompt: string): boolean {
  if (wantsModelImage(userPrompt)) return true;
  return /rotary|annulus|hero gauge|battery gauge|model bg|model behind|tinywhoop|whoop overview|quad overview/i.test(
    userPrompt
  );
}

function wantsGaugeSatelliteLayout(userPrompt: string): boolean {
  return /annulus|rotary gauge|battery gauge|voltage hero|hero gauge/i.test(userPrompt);
}

function layoutReferenceExample(archetypeId: LayoutArchetypeId, userPrompt: string): string | null {
  if (archetypeId === "quad-overview") {
    return "tx15-bfdash8f-whoop-dashboard.lua";
  }
  if (archetypeId === "hero-minimal" && wantsGaugeSatelliteLayout(userPrompt)) {
    return "tx15-bfdash8f-whoop-dashboard.lua";
  }
  return null;
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
  const rotorflightGuide =
    catalog.protocol === "rotorflight" && archetype.id === "heli-rotorflight"
      ? readRotorflightStyleGuide()
      : "";
  const companionGuide = readCompanionScriptsGuide();
  const modelImageGuide = wantsModelImage(userPrompt) ? readModelImageGuide() : "";
  const modelHeroGuide = wantsModelHeroDashboard(userPrompt) ? readModelHeroDashboardGuide() : "";
  const runtimeApiPitfalls = readRuntimeApiPitfallsGuide();
  const textLayoutGuide = readTextLayoutGuide();
  const layoutReservedRectsGuide = readLayoutReservedRectsGuide();
  const themePalettesGuide = readThemePalettesGuide();
  const roundedCornersGuide = wantsRoundedCorners(userPrompt) ? readRoundedCornersGuide() : "";
  const rules = readRules();

  const exampleFile = EXAMPLE_BY_ARCHETYPE[archetype.id];
  const exampleSnippet = readExampleSnippetForArchetype(exampleFile);
  const layoutRefFile = layoutReferenceExample(archetype.id, userPrompt);
  const layoutRefSnippet = layoutRefFile ? readLayoutExampleSnippet(layoutRefFile) : "";

  const starterSection = shouldIncludeCardStarter(archetype.id)
    ? `\n## Starter template (card layout reference — vary metrics and proportions per creative brief)\n\n\`\`\`lua\n${readTemplate("dashboard-starter.lua")}\n\`\`\`\n`
    : "";

  const exampleSection = exampleSnippet
    ? `\n## API / typography snippet (do NOT copy coordinates or layout)\n\n\`\`\`lua\n${exampleSnippet}\n\`\`\`\n`
    : "";

  const layoutRefSection =
    layoutRefSnippet && layoutRefFile && layoutRefFile !== exampleFile
      ? `\n## Reserved-rect layout reference (mandatory for gauge + strip dashboards)\n\nFollow \`layout-reserved-rects.md\` — compute all rects before drawing. Reference:\n\n\`\`\`lua\n${layoutRefSnippet}\n\`\`\`\n`
      : "";

  const assignedNameSection = ctx?.assignedWidgetName
    ? `\n## Assigned dashboard identity (mandatory)

**Radio display name:** \`${ctx.assignedWidgetName}\` (≤10 chars — used in \`local name\` and on the SD card under WIDGETS/)
**Workspace id:** \`${ctx.widgetInstanceId ?? "<uuid>"}\` (UUID folder — unique per chat even when display names match)
**Version:** ${ctx.widgetVersion ?? 0} (refine count)

- Write the dashboard to \`generated/${ctx.widgetInstanceId ?? "<uuid>"}/main.lua\` — **never** use the display name as the folder.
- Set \`local name = "${ctx.assignedWidgetName}"\` and \`return { name = name, ... }\`.
- Call validateWidget with **widgetInstanceId** \`${ctx.widgetInstanceId ?? "<uuid>"}\` (not the display name). Install guide + zip packaging run automatically after validation.
- The display name may match another widget; the workspace UUID is what keeps this chat isolated.\n`
    : "";

  const widgetFolder = ctx?.widgetInstanceId ?? ctx?.assignedWidgetName ?? "<uuid>";
  const referenceImagesSection = buildReferenceImagesSection(ctx?.referenceImageCount ?? 0, radio.name);

  return `You are generating an EdgeTX Lua **full-screen dashboard** (widget script) for ${radio.name}.

Primary goal: a **clean, modern, readable** dashboard tailored to the user's request — not a copy of a fixed template.

## User request (layout and metrics — must still obey the selected protocol below)

${userPrompt}

${referenceImagesSection ? `\n${referenceImagesSection}\n` : ""}

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

## Target radio

${JSON.stringify({ id: radio.id, name: radio.name, lcdW: radio.lcdW, lcdH: radio.lcdH, edgeTxMin: radio.edgeTxMin }, null, 2)}

## EdgeTX version target

${edgeTxVersion ?? radio.edgeTxMin}+

## Visual design (mandatory)

${designGuide}

${themePalettesGuide ? `\n## EdgeTX theme palettes and gauges (mandatory reference)\n${themePalettesGuide}` : ""}

${roundedCornersGuide ? `\n## Rounded card panels (user requested — lcd API only)\n${roundedCornersGuide}` : ""}

${rotorflightGuide ? `\n## Rotorflight telemetry idioms (RQLY, zero handling — layout governed by creative brief + archetype)\n${rotorflightGuide}` : ""}

## Companion scripts (when user asks for tools, loggers, selectors)

${companionGuide}

${modelImageGuide ? `\n## Model image (user requested — include ShowModel option + placeholder)\n${modelImageGuide}` : ""}

${modelHeroGuide ? `\n## Model-background + hero gauge layout (mandatory for this request)\n${modelHeroGuide}\n\nReference snippet (layer order + gauge — do NOT copy coordinates verbatim):\n\n\`\`\`lua\n${readLayoutExampleSnippet("tx15-model-hero-dashboard.lua")}\n\`\`\`` : ""}

## Runtime API pitfalls (mandatory — validateWidget enforces these)

${runtimeApiPitfalls}

## TX15 text layout (mandatory — height-aware stacking in cards and gauges)

${textLayoutGuide}

## Reserved rectangles (mandatory when using annulus gauges, strip cards, or optional BOOL bands)

${layoutReservedRectsGuide}

**Do not implement custom overlap loops** (\`anyTextForeignOverlap\`, \`anyLayoutOverlap\`, \`layoutAllRects\` audit passes, etc.). Size regions with \`gaugeZoneH\` / \`barsBlockH\` planning math; \`validateWidget\` checks actual \`lcd.*\` draw geometry for annulus-vs-text and text-vs-text collisions.
${assignedNameSection}
## Hard rules

${rules}
${starterSection}${exampleSection}${layoutRefSection}

## Your tasks

${ctx?.assignedWidgetName ? `1. Use display name \`${ctx.assignedWidgetName}\` and workspace id \`${ctx.widgetInstanceId}\` (see above).\n\n2. Write the main dashboard to \`generated/${ctx.widgetInstanceId}/main.lua\`.` : "1. Choose a dashboard name (max 10 chars, no spaces) that fits the use case.\n\n2. Write the main dashboard to `generated/<uuid>/main.lua`."}

3. If the user requested battery selection, flight logging, log viewing, or similar: add companion scripts under \`generated/${widgetFolder}/tools/\` and/or \`generated/${widgetFolder}/telemetry/\` per the companion-scripts guide.

4. Start main.lua with edgetx-dev-kit annotations:

   \`\`\`lua
   ---@type WidgetScript
   ---@simulate Layout1x1 zone=0
   \`\`\`

5. Build UI for archetype **${archetype.id}** per the creative brief:

   - Cache ALL display strings as locals before drawText
   - Put all \`lcd.drawText\`, \`lcd.drawFilledRectangle\`, and \`lcd.drawRectangle\` calls **directly in refresh()** (web preview parses these)
   - **\`lcd.drawLine(x1,y1,x2,y2,SOLID,color)\`** — 5th arg is line pattern (\`SOLID\`/\`DOTTED\`), not color (WASM crashes if color is 5th arg)
   - **\`Bitmap.getSize(bitmap)\`** — pass the handle from \`Bitmap.open()\`, never the SD path string (\`create()\` crash)
   - Use LCD_W and LCD_H on ${radio.name} (${radio.lcdW}x${radio.lcdH})

6. Cache telemetry with getSourceIndex() in create() using **only** sensors from the catalog above.

7. Call validateWidget with widgetInstanceId "${widgetFolder}", protocol "${catalog.protocol}", radioId "${radio.id}", and layoutArchetype "${archetype.id}". Fix ALL errors and **archetype-relevant** visual-design warnings until valid: true. Do **not** call writeInstallGuide or packageWidget — the server packages after validation.

8. Summarize in markdown: chosen archetype, creative brief choices, layout sections, sensors used, companion scripts (if any), and brief SD-card install steps (WIDGETS/<name>/).`;
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
  const themePalettesGuide = readThemePalettesGuide();
  const roundedCornersGuide = wantsRoundedCorners(userPrompt) ? readRoundedCornersGuide() : "";
  const modelImageGuide = wantsModelImage(userPrompt) ? readModelImageGuide() : "";
  const modelHeroGuide = wantsModelHeroDashboard(userPrompt) ? readModelHeroDashboardGuide() : "";
  const runtimeApiPitfalls = readRuntimeApiPitfallsGuide();
  const textLayoutGuide = readTextLayoutGuide();
  const layoutReservedRectsGuide = readLayoutReservedRectsGuide();
  const layoutRefFile = layoutReferenceExample(archetype.id, userPrompt);
  const layoutRefSnippet = layoutRefFile ? readLayoutExampleSnippet(layoutRefFile) : "";
  const referenceImagesSection = buildReferenceImagesSection(
    ctx?.referenceImageCount ?? 0,
    loadRadioProfile(radioId).name
  );

  return `Refine the existing EdgeTX dashboard${widgetName ? ` (display name "${widgetName}")` : ""}${ctx?.widgetInstanceId ? ` in workspace \`${ctx.widgetInstanceId}\` (v${ctx.widgetVersion ?? 0})` : ""}.

## User refinement request

${userPrompt}

${ctx?.refineHistory ? `\n## Prior chat summary\n\n${ctx.refineHistory.conversationSummary}\n` : ""}
${ctx?.refineHistory ? `\n## Design artifacts (current + prior versions)\n\n${ctx.refineHistory.artifactContext}\n` : ""}
${referenceImagesSection ? `\n${referenceImagesSection}\n` : ""}

${buildTelemetrySection(catalog)}

${brief.markdown}

${visualStyle.promptNotes ? `\n${visualStyle.promptNotes}\n` : ""}

## Layout direction (if refinement changes structure)

**${archetype.title}** (\`${archetype.id}\`) — ${archetype.summary}

${archetype.layoutNotes}

## Visual design standards

${designGuide}

${themePalettesGuide ? `\n## EdgeTX theme palettes and gauges\n${themePalettesGuide}` : ""}

${roundedCornersGuide ? `\n## Rounded card panels (user requested — lcd API only)\n${roundedCornersGuide}` : ""}

${rotorflightGuide ? `\n## Rotorflight telemetry idioms (layout governed by creative brief + archetype)\n${rotorflightGuide}` : ""}

## Companion scripts

${companionGuide}

${modelImageGuide ? `\n## Model image (refinement — include ShowModel + placeholder)\n${modelImageGuide}` : ""}

${modelHeroGuide ? `\n## Model-background + hero gauge layout (apply to refinement)\n${modelHeroGuide}\n\nReference snippet:\n\n\`\`\`lua\n${readLayoutExampleSnippet("tx15-model-hero-dashboard.lua")}\n\`\`\`` : ""}

${layoutRefSnippet ? `\n## Reserved-rect layout reference (gauge + strip dashboards)\n\n\`\`\`lua\n${layoutRefSnippet}\n\`\`\`\n` : ""}

## Runtime API pitfalls (mandatory — validateWidget enforces these)

${runtimeApiPitfalls}

## TX15 text layout (mandatory — height-aware stacking)

${textLayoutGuide}

## Reserved rectangles (mandatory when using annulus gauges, strip cards, or optional BOOL bands)

${layoutReservedRectsGuide}

**Do not implement custom overlap loops** (\`anyTextForeignOverlap\`, \`anyLayoutOverlap\`, \`layoutAllRects\` audit passes, etc.). Size regions with planning math; \`validateWidget\` checks actual \`lcd.*\` draw geometry.

Keep the dashboard clean and distinct from generic templates. All lcd.* draws must stay directly in refresh().

## Tasks

1. Edit files under \`generated/${ctx?.widgetInstanceId ?? "<uuid>"}/\` as needed (main.lua + any tools/telemetry companions). Start from the **current widget source** above when provided; otherwise read main.lua from the workspace folder.

2. Run validateWidget with widgetInstanceId "${ctx?.widgetInstanceId ?? "<uuid>"}", protocol "${resolvedProtocol}", radioId "${radioId}", and layoutArchetype "${archetype.id}" until valid: true. Fix **all errors** (including runtime API pitfalls: drawLine pattern arg, Bitmap.getSize handle) and archetype-relevant visual-design warnings. Do **not** call writeInstallGuide or packageWidget — the server packages after validation.

3. Summarize changes made, including install instructions for any new companion scripts.`;
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
