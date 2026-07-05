# AGENTS.md

Guidance for AI agents working in this repository.

## What this project is

An **EdgeTX Lua dashboard generator** for **RadioMaster TX15** (480×320). Users describe a dashboard in natural language; a Cursor SDK agent writes `generated/<Name>/main.lua` (plus optional companion scripts), validates, and packages a zip with INSTALL.md for the radio SD card.

**Stack:** npm workspaces monorepo — Next.js web UI (`apps/web`), generator/CLI (`packages/generator`), shared types (`packages/shared`), WASM radio preview (`packages/sim-preview`).

**Telemetry protocols:** `betaflight`, `rotorflight`, `generic-crsf` (sensor catalogs in `knowledge/telemetry/`).

## Commands

```bash
npm install
npm run setup          # recommended: stubs + WASM + patch + build
npm run setup:sim      # Radio sim only: WASM (if missing) + patch + sim-preview build
npm run build          # shared → sim-preview → generator → web (order matters)
npm test               # unit tests (shared, sim-preview, generator, web preview)
npm run test:wasm      # optional: after npm run sync-wasm
npm run typecheck      # all workspaces
npm run dev            # web UI at http://localhost:3000 (needs CURSOR_API_KEY)
npm run generate -- --protocol betaflight "prompt"
npm run sync-stubs     # fetch stubs/2.11/ if missing
npm run sync-wasm      # force re-download TX15 WASM (normally automatic on install/dev)
```

**Requires:** Node **22.13+**, `CURSOR_API_KEY` for generation.

## Repository layout

| Path | Purpose |
|------|---------|
| `apps/web/` | Next.js UI, API routes (`/api/generate`, `/api/refine`, `/api/download`, `/api/validate`, `/api/widget-source`) |
| `packages/generator/` | SDK agent, validation, packaging, CLI |
| `packages/shared/` | Shared TS types, `@simulate` layout helpers, `drawSurface` |
| `packages/sim-preview/` | EdgeTX WASM runtime (`SimRuntime`), virtual SD, CRSF telemetry bridge |
| `knowledge/` | Radio profiles, telemetry catalogs, visual design guide |
| `templates/` | `dashboard-starter.lua`, `INSTALL.md.tpl` |
| `examples/` | Gold-standard reference widget (`tx15-minimal-dashboard.lua`) |
| `stubs/2.11/` | EdgeTX LuaLS stubs (committed; refresh via `npm run sync-stubs`) |
| `apps/web/public/sim/` | EdgeTX WASM firmware for Radio sim (auto-fetched on `npm install` / `npm run dev`; force refresh via `npm run sync-wasm`) |
| `generated/` | **Gitignored** — agent-written widgets |
| `dist-output/` | **Gitignored** — packaged zips |
| `.cursor/rules/edgetx-lua.md` | Lua widget rules injected into generation prompts |

## Agent skills

Matt Pocock engineering skills are installed locally (not committed):

```bash
npx skills add mattpocock/skills
```

- Installed copy: `.agents/skills/` (gitignored)
- Lock file: `skills-lock.json` (committed)
- First-time repo setup: run the `setup-matt-pocock-skills` skill if using those workflows

Built-in Cursor skills under `~/.cursor/skills-cursor/` apply globally.

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

## Working on TypeScript

- **Build order:** `@widget-gen/shared` → `@widget-gen/sim-preview` → `@widget-gen/generator` → `@widget-gen/web`
- Match existing style: minimal diffs, no drive-by refactors
- Run `npm test` and `npm run build` after generator/shared changes
- Do not commit unless the user asks

## Working on the web UI

- **Preview tab:** EdgeTX WASM framebuffer (cropped to `@simulate` zone) via `SimFrameCanvas` + `paintSimFrame.ts`. **Open interactive sim** button below the preview opens the full `@edgetx/simulator-ui` overlay (touch/keys/sticks).
- Mock telemetry: `apps/web/src/lib/mockTelemetry.ts` (shared with CRSF bridge in sim-preview)
- Optional API auth: `GENERATOR_API_SECRET` (see `.env.example`)
- Radio sim firmware: auto-downloaded by `scripts/ensure-edgetx-wasm.mjs` on postinstall and `npm run dev` → `apps/web/public/sim/`. Manual refresh: `npm run sync-wasm`. Set `SKIP_WASM_SYNC=1` to skip fetch (e.g. CI without sim).

## Security

- Never commit `.env`, API keys, or secrets
- `GENERATOR_API_SECRET` optional for non-localhost API use
- Sanitize widget names via `packages/generator/src/paths.ts` (no path traversal)
- Do not expose absolute filesystem paths in SSE responses

## What not to edit

- Do not modify user plan files under `.cursor/plans/` unless asked
- Do not commit `generated/`, `dist-output/`, or `.agents/`
- Do not add `require()` or filesystem access to generated Lua

## Reference links

- [EdgeTX Lua docs](https://luadoc.edgetx.org/)
- [EdgeTX Dev Kit](https://github.com/JeffreyChix/edgetx-dev-kit)
- [Cursor SDK](https://cursor.com/docs/sdk/typescript)
