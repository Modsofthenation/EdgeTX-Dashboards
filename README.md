# EdgeTX Dashboard Generator

Prompt-driven generator for EdgeTX Lua **full-screen dashboards**, targeting color LCD radios (default **RadioMaster TX15** 480×320) with telemetry for **Betaflight**, **Rotorflight**, and **generic CRSF**. Can also generate companion **Tool** and **Telemetry** scripts (battery selector, flight logger, log viewer) packaged with install instructions.

Built with the [Cursor SDK](https://cursor.com/docs/sdk/typescript) (`@cursor/sdk`) and a Next.js web UI.

## Prerequisites

- **Node.js 22.13+** (required by `@cursor/sdk`)
- **Cursor API key** — set `CURSOR_API_KEY` in your environment ([Cursor Dashboard → Integrations](https://cursor.com/dashboard/integrations))

## Quick start

```bash
# Install dependencies (also patches @edgetx/simulator-ui via postinstall)
npm install

# One-shot: sync stubs + WASM firmware, patch simulator-ui, build all packages
npm run setup

# Start web UI
export CURSOR_API_KEY="cursor_..."   # Windows PowerShell: $env:CURSOR_API_KEY="cursor_..."
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), describe your dashboard, and download the generated zip for your radio SD card.

### Setup commands (reference)

| Command | When to run |
|---------|-------------|
| `npm install` | First clone; re-run after dependency updates. Runs `postinstall` → patches `@edgetx/simulator-ui`. |
| `npm run setup` | **Recommended first-time setup** — stubs + WASM + patch + full build. |
| `npm run setup:sim` | Radio sim tab broken or after `@edgetx/simulator-ui` reinstall — WASM + patch + `sim-preview` build only. |
| `npm run build` | After changing `packages/*` or before production deploy. |
| `npm run sync-stubs` | Fetch LuaLS stubs into `stubs/2.11/` (VS Code Dev Kit + validation). |
| `npm run sync-wasm` | Fetch TX15 WASM into `apps/web/public/sim/` (~5 MB; required for **Sim** tab). |
| `node scripts/patch-simulator-ui.mjs` | Re-apply EdgeTX 2.11 env stubs if Radio sim errors on `simuAuxSerial*`. Also runs on `npm install`. |
| `npm run test:wasm` | Verify WASM manifest + file presence after `sync-wasm`. |

Manual equivalent of `npm run setup`:

```bash
npm install
node scripts/patch-simulator-ui.mjs
npm run sync-stubs
npm run sync-wasm
npm run build
```

## Web UI preview modes

The output panel has three tabs:

| Tab | What it runs | Setup needed |
|-----|--------------|--------------|
| **Preview** | Fast regex canvas at 480×320 with mock telemetry | None beyond `npm run build` |
| **Radio sim** | Real EdgeTX 2.11 WASM Lua runtime | `npm run setup:sim` (or full `npm run setup`) |
| **Lua** | Source viewer | Generated widget only |

After changing sim-preview code or reinstalling deps, restart `npm run dev` and hard-refresh the browser (Ctrl+Shift+R).

### Radio sim troubleshooting

| Error / symptom | Fix |
|-----------------|-----|
| Stuck on “Loading Radio sim…” | Restart dev server; check browser console for worker errors. |
| `simuAuxSerialStart: function import requires a callable` | `npm run setup:sim` then restart dev server. |
| `Cannot use 'in' operator to search for '_start' in undefined` | Rebuild sim-preview (`npm run setup:sim`); ensure dev server restarted after code changes. |
| WASM file missing / 404 on `/sim/*.wasm` | `npm run sync-wasm` or `npm run setup:sim`. |

## EdgeTX Dev Kit (VS Code simulation)

1. Install **Lua** + **EdgeTX Dev Kit** (see `.vscode/extensions.json`).
2. Open a generated `main.lua` — annotations are added automatically:
   ```lua
   ---@type WidgetScript
   ---@simulate Layout1x1 zone=0
   ```
3. **EdgeTX: Simulate Script** or **Watch Script** for live reload.

The web UI live preview also reads `@simulate` to size the widget zone on the 480×320 canvas.

The web UI also includes an **Install & verify guide** and bundles **INSTALL.md** inside each downloaded zip.

## CLI usage

```bash
npm run build
export CURSOR_API_KEY="cursor_..."
npm run generate -- --protocol betaflight "Full-screen battery and GPS dashboard"
```

Options:

- `--radio tx15` — radio profile (default: tx15)
- `--protocol betaflight|rotorflight|generic-crsf`
- `--edge-tx 2.11.0`

## Project structure

```
apps/web/              Next.js UI + API routes (SSE streaming)
packages/generator/    Cursor SDK orchestration, validation, packaging
packages/shared/       Shared TypeScript types, @simulate layouts
packages/sim-preview/  EdgeTX WASM radio preview (SimRuntime, telemetry bridge)
knowledge/             Radio profiles, layout zones, telemetry catalogs
stubs/2.11/            EdgeTX LuaLS stubs (edgetx-stubs, via npm run sync-stubs)
apps/web/public/sim/   EdgeTX WASM firmware (via npm run sync-wasm)
templates/             Lua starter template and INSTALL.md template
examples/              Reference widgets
generated/             Agent output (gitignored)
dist-output/           Packaged zips (gitignored)
.cursor/rules/         EdgeTX Lua constraints for the agent
```

## Deploying to TX15

1. Download the generated `.zip`
2. Copy `WIDGETS/<WidgetName>/` to your radio SD card
3. **Model → Telemetry → Discover new** (power on FC/receiver first)
4. Add widget to main view, then enter **Full screen** (double-tap on TX15)
5. Read `INSTALL.md` in the zip for protocol-specific setup (e.g. Rotorflight `rf2bg`)

## Telemetry protocols

| Protocol | Catalog file | Notes |
|----------|--------------|-------|
| Betaflight | `knowledge/telemetry/betaflight-crsf.json` | Standard CRSF sensors via ELRS/Crossfire |
| Rotorflight | `knowledge/telemetry/rotorflight-crsf.json` | Requires `rf2bg` special function for custom sensors |
| Generic CRSF | `knowledge/telemetry/generic-crsf.json` | Common ELRS/CRSF sensor names |

## Validation pipeline

Before any widget zip is offered for download, the generator runs:

1. **Static checks** (TypeScript) — `return { name, create, refresh }`, name ≤10 chars, no `require`/`dofile`/`loadstring`, option name constraints
2. **Constraint checks** — telemetry sensor names must exist in the selected protocol catalog (`strictTelemetry: true`)
3. **Agent tool** — `validateWidget` custom tool uses the same pipeline; agent must reach `valid: true` before `packageWidget`

Download is **blocked** (HTTP 422) if validation fails. The UI shows errors and prompts refinement.

`GET /api/validate?sessionId=...` returns the full validation report.

**Phase 2:** [edgetx-dev-kit](https://github.com/JeffreyChix/edgetx-dev-kit) LuaLS stubs + `@simulate` for dev-time simulation.

3. **Dev-kit checks** — `---@type WidgetScript`, `---@simulate` layout/zone, stub-aware `lcd.*` API validation (EdgeTX 2.11 stubs in `stubs/2.11/`)

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CURSOR_API_KEY` | Yes | Cursor API key for SDK agent runs |
| `GENERATOR_API_SECRET` | No | If set, API routes require `Authorization: Bearer <secret>` or `X-Generator-Secret` header |

## License

MIT — see [LICENSE](LICENSE)
