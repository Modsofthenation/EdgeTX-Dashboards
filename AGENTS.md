# AGENTS.md

An **EdgeTX Lua dashboard generator** for **RadioMaster TX15** (480×320). Users describe a dashboard in natural language; a Cursor SDK agent writes `generated/<Name>/main.lua` (plus optional companion scripts), validates it, and packages a zip with INSTALL.md for the radio SD card.

Telemetry protocols: `betaflight`, `rotorflight`, `generic-crsf` (sensor catalogs in `knowledge/telemetry/`).

## Task Completion Requirements

- Keep local verification focused on the files and packages changed. Run the smallest relevant test set; do not run the full workspace suite as a routine completion step.
  - One file: `node --experimental-strip-types --test packages/generator/src/validate.test.ts`. Web tests need the `~/*` alias, so run them with `tsx`: `cd apps/web && npx tsx --test src/lib/luaPreviewEngine.test.ts`.
  - One package: `npm run test -w @widget-gen/generator`.
  - Run `npm run lint` and `npm run typecheck -w <workspace>` for the affected scope.
- **Before every commit/push:** run `npm run fmt:changed`, then confirm `npm run fmt:check` passes. CI fails on Prettier drift (`**/*.{ts,tsx,mjs,json,md,css}`), including markdown tables in READMEs.
- Do not run repo-wide `npm test` or `npm run build` locally unless the user asks. CI owns full verification.
- After a user-visible web change, verify the affected flow in the browser against `npm run dev`, then stop the dev server.
- Do not commit unless the user asks.

## Package Roles

- `apps/web`: Next.js UI and API routes. Owns chat UX, SSE consumption, previews, SQLite chat history.
- `packages/generator`: Cursor SDK agent, prompt composition, validation pipeline, zip packaging, CLI.
- `packages/shared`: Shared types, `@simulate` layout profiles, and the `drawSurface` refresh-body contract. No IO.
- `packages/sim-preview`: EdgeTX WASM runtime (`SimRuntime`), virtual SD card, CRSF telemetry bridge.
- `packages/layout-verify`: Static Lua draw interpreter plus overlap and geometry checks.
- `packages/editor-core`: Lua ↔ scene document model behind the visual editor.

## Workspace Conventions

- Packages are consumed as TypeScript source: `exports` resolve to `src/*.ts`, there is no `dist/` and no build step. Only `apps/web` builds.
- Relative imports carry real extensions (`./validate.ts`).
- Tests sit next to the module they cover (`validate.ts` / `validate.test.ts`) and are discovered by glob — new test files need no script changes.
- `apps/web` resolves internal modules through `~/*`.
- Compiler options live in `tsconfig.base.json`; packages and `apps/web` extend it.
- Match existing style: minimal diffs, no drive-by refactors.

Layout and script details: [docs/reference/workspace-layout.md](docs/reference/workspace-layout.md), [docs/reference/scripts.md](docs/reference/scripts.md).

## Generating widgets (SDK agent)

The generation agent (`packages/generator/src/agent.ts`) uses custom tools from `agentTools.ts` (prompts in `promptComposer.ts`):

1. `listTelemetrySensors` — only use catalog sensor names
2. Write `generated/<WidgetName>/main.lua`
3. `validateWidget` — must return `valid: true` (errors block download)
4. `writeInstallGuide` then `packageWidget` — only after validation passes

Prompts are built in `buildGenerationPrompt()` / `buildRefinePrompt()` and include:

- `.cursor/rules/edgetx-lua.md`
- `knowledge/design/tx15-dashboard-ui.md`
- Starter template + `examples/tx15-minimal-dashboard.lua`
- **Refine only:** prior chat summary + versioned Lua snapshots from SQLite (`refineHistory.ts` via `/api/refine`)

### Lua output requirements (summary)

- `---@type WidgetScript` and `---@simulate Layout1x1 zone=0` at top
- Return `{ name, create, refresh }` — name ≤10 chars
- **Clean UI:** card panels, 12px grid, dark theme, label/value hierarchy
- All `lcd.drawText` / `lcd.drawFilledRectangle` / `lcd.drawRectangle` **directly in `refresh()`** (web preview parses these)
- Cache telemetry with `getSourceIndex()` in `create()`
- No `require`, `dofile`, `io.*`, etc.

Full rules: `.cursor/rules/edgetx-lua.md` and `knowledge/design/tx15-dashboard-ui.md`.

## Validation pipeline

Pure validation (`validateWidgetLua`) is separate from filesystem mutation (`WidgetWorkspace`):

- **`WidgetWorkspace`** (`packages/generator/src/workspace.ts`) — read source, inject `---@type` / `---@simulate` once, write if changed
- **`validateWidgetForRelease()`** (`validationPipeline.ts`) — workspace prepare → pure `validateWidgetLua`
- **`buildReleaseValidationContext()`** (`validationContext.ts`) — radio, telemetry catalog, simulate profile
- **`analyzeDrawSurface()`** (`packages/shared/src/drawSurface.ts`) — shared refresh-body contract for validator + web preview

TX15 `@simulate` zones live in `packages/shared/src/layouts/tx15.json` (via `getSimulateLayoutProfile()`).

Steps:

1. Workspace injects dev-kit annotations if missing
2. Static checks (structure, forbidden APIs, name/options)
3. Telemetry catalog match (`strictTelemetry: true`)
4. Dev-kit annotations + stub-aware `lcd.*` checks
5. **Runtime API checks** (`lcdApiValidate.ts`) — `lcd.drawLine` pattern arg, `Bitmap.getSize` handle (see `knowledge/design/runtime-api-pitfalls.md`)
6. Visual-design warnings (card layout, text density)

Warnings do not block download; errors do. Download returns **HTTP 422** when invalid.

## Working on the web UI

- **Preview tab:** EdgeTX WASM framebuffer (cropped to `@simulate` zone) via `SimFrameCanvas` + `paintSimFrame.ts`. **Open interactive sim** button below the preview opens the full `@edgetx/simulator-ui` overlay (touch/keys/sticks).
- Mock telemetry: `apps/web/src/lib/mockTelemetry.ts` (shared with CRSF bridge in sim-preview)
- Optional API auth: `GENERATOR_API_SECRET` (see `.env.example`)
- AI providers: Cursor (default), Anthropic, OpenAI — Preferences → AI or env `CURSOR_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` (request headers `x-ai-provider` + provider key header)
- Radio sim firmware: auto-downloaded by `scripts/ensure-edgetx-wasm.mjs` on postinstall and `npm run dev` → `apps/web/public/sim/`. Manual refresh: `npm run sync-wasm`. Set `SKIP_WASM_SYNC=1` to skip fetch (e.g. CI without sim).
- API routes reach the generator only through `apps/web/src/server/generatorFacade.ts`.

## Agent skills

Matt Pocock engineering skills are installed locally (not committed):

```bash
npx skills add mattpocock/skills
```

- Installed copy: `.agents/skills/` (gitignored)
- Lock file: `skills-lock.json` (committed)
- First-time repo setup: run the `setup-matt-pocock-skills` skill if using those workflows

Built-in Cursor skills under `~/.cursor/skills-cursor/` apply globally.

## Security

- Never commit `.env`, API keys, or secrets
- `GENERATOR_API_SECRET` optional for non-localhost API use
- Sanitize widget names via `packages/generator/src/paths.ts` (no path traversal)
- Do not expose absolute filesystem paths in SSE responses

## What not to edit

- Do not modify user plan files under `.cursor/plans/` unless asked
- Do not commit `generated/`, `dist-output/`, or `.agents/`
- Do not add `require()` or filesystem access to generated Lua

## Cursor Cloud specific instructions

Environment is refreshed by the startup update script `npm install` (its `postinstall` patches `@edgetx/simulator-ui` and downloads the EdgeTX WASM firmware into `apps/web/public/sim/`). No extra setup is needed. Non-obvious caveats:

- **`CURSOR_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` gate AI generation** (provider selected in Preferences → AI). Without a key for the selected provider, `npm run dev` still boots at `http://localhost:3000` and the editor, `/api/validate`, layout preview, and EdgeTX WASM simulator all work; only `/api/generate` and `/api/refine` are blocked. Add the matching secret to exercise the chat generation flow.
- **The `/editor` center canvas is a scene/layers editor, not a live pixel preview** — it looks blank/black even for a valid widget. To see the widget actually rendered, use **Run in simulator** / **Verify in sim** in the editor (or the home-page **Preview** tab), which run the real EdgeTX firmware via WASM. A blank editor canvas is expected, not a bug.
- **Verify the WASM sim runtime headlessly** with `npm run test:wasm` (executes real firmware against the golden example widgets). Use `SKIP_WASM_SYNC=1` only if the firmware download is unavailable — the Sim/Preview tabs won't render without it.

## Reference links

- [Documentation index](docs/README.md)
- [EdgeTX Lua docs](https://luadoc.edgetx.org/)
- [EdgeTX Dev Kit](https://github.com/JeffreyChix/edgetx-dev-kit)
- [Cursor SDK](https://cursor.com/docs/sdk/typescript)
