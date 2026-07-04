# EdgeTX Widget Generator

Prompt-driven generator for EdgeTX Lua full-screen dashboard widgets, targeting **RadioMaster TX15** (480×320) with telemetry support for **Betaflight**, **Rotorflight**, and **generic CRSF**.

Built with the [Cursor SDK](https://cursor.com/docs/sdk/typescript) (`@cursor/sdk`) and a Next.js web UI.

## Prerequisites

- **Node.js 22.13+** (required by `@cursor/sdk`)
- **Cursor API key** — set `CURSOR_API_KEY` in your environment ([Cursor Dashboard → Integrations](https://cursor.com/dashboard/integrations))

## Quick start

```bash
# Install dependencies
npm install

# Build packages
npm run build

# Start web UI
export CURSOR_API_KEY="cursor_..."
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), describe your dashboard, and download the generated zip for your radio SD card.

## EdgeTX Dev Kit (VS Code simulation)

For WASM firmware simulation with real EdgeTX Lua APIs:

```bash
npm run sync-stubs   # fetch LuaLS stubs into stubs/2.11/
```

1. Install **Lua** + **EdgeTX Dev Kit** (see `.vscode/extensions.json`).
2. Open a generated `main.lua` — annotations are added automatically:
   ```lua
   ---@type WidgetScript
   ---@simulate Layout1x1 zone=0
   ```
3. **EdgeTX: Simulate Script** or **Watch Script** for live reload.

The web UI live preview also reads `@simulate` to size the widget zone on the 480×320 canvas.

The web UI includes:
- **Live preview** — canvas render of the generated widget at 480×320 with mock telemetry that updates every few seconds
- **Install & verify guide** — step-by-step checklist with "Ensure:" verification points per protocol
- **INSTALL.md** — also bundled inside each downloaded zip

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
packages/shared/       Shared TypeScript types
knowledge/             Radio profiles, layout zones, telemetry catalogs
stubs/2.11/            EdgeTX LuaLS stubs (edgetx-stubs, via npm run sync-stubs)
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
