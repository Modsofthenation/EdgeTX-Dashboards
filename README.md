# EdgeTX Dashboards

Generate validated EdgeTX Lua dashboards for color LCD radios from a plain-language description. Browse a project library, chat in Studio, fine-tune in the visual Editor, then download an SD-card install zip.

**Default radio:** RadioMaster TX15 (480×320 full-screen widgets).  
**Telemetry:** Betaflight, Rotorflight, and generic CRSF.  
**UI stack:** shadcn/ui + Tailwind CSS v4 shared app shell.

<p align="center">
  <img src="docs/screenshots/readme-home-dark.png" alt="Home library in Dark theme with AI Studio, Templates, and Blank quick starts" width="920" />
</p>

<p align="center">
  <sub>Home · Dark · project library and quick starts</sub>
</p>

## Highlights

- **Browse → Create → Refine → Ship** in one sidebar shell (Home · Studio · Editor · Templates · Settings)
- Cursor agent writes `main.lua` (and optional companion scripts) against real EdgeTX rules
- In-browser **EdgeTX TX15 WASM** preview with mock CRSF telemetry
- Visual **Editor**: layers, properties, multi-select, telemetry bind, Insert prefabs, Export Sheet
- **Nineteen UI themes** (LCD canvas stays dark in every theme)
- **Settings → AI** for a browser API key or server `CURSOR_API_KEY` / Anthropic / OpenAI / Gemini
- Desktop installers for **Windows / macOS / Linux** (manual Actions workflow)

## Tour

Screens below were recaptured from a live `npm run dev` session (`scripts/capture-readme-screenshots.ts`) across every primary surface and every UI theme.

### Home library

The app opens on **Home** (`/`): recent projects plus three equal entry paths — **AI Studio**, **Templates**, and **Blank / Import**.

<p align="center">
  <img src="docs/screenshots/readme-home-dark.png" alt="Home library in Dark theme" width="900" />
</p>

<p align="center">
  <sub>Home · Dark</sub>
</p>

<details>
<summary>All Home themes (19)</summary>

<p align="center">
  <img src="docs/screenshots/readme-home-light.png" alt="Home · Light" width="280" />
  <img src="docs/screenshots/readme-home-dark.png" alt="Home · Dark" width="280" />
  <img src="docs/screenshots/readme-home-midnight.png" alt="Home · Midnight" width="280" />
</p>
<p align="center">
  <sub>Light · Dark · Midnight</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-home-slate.png" alt="Home · Slate" width="280" />
  <img src="docs/screenshots/readme-home-forest.png" alt="Home · Forest" width="280" />
  <img src="docs/screenshots/readme-home-ocean.png" alt="Home · Ocean" width="280" />
</p>
<p align="center">
  <sub>Slate · Forest · Ocean</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-home-contrast.png" alt="Home · High contrast" width="280" />
  <img src="docs/screenshots/readme-home-graphite.png" alt="Home · Graphite" width="280" />
  <img src="docs/screenshots/readme-home-meadow.png" alt="Home · Meadow" width="280" />
</p>
<p align="center">
  <sub>High contrast · Graphite · Meadow</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-home-fog.png" alt="Home · Fog" width="280" />
  <img src="docs/screenshots/readme-home-ember.png" alt="Home · Ember" width="280" />
  <img src="docs/screenshots/readme-home-volt.png" alt="Home · Volt" width="280" />
</p>
<p align="center">
  <sub>Fog · Ember · Volt</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-home-copper.png" alt="Home · Copper" width="280" />
  <img src="docs/screenshots/readme-home-aurora.png" alt="Home · Aurora" width="280" />
  <img src="docs/screenshots/readme-home-sunset.png" alt="Home · Sunset" width="280" />
</p>
<p align="center">
  <sub>Copper · Aurora · Sunset</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-home-prism.png" alt="Home · Prism" width="280" />
  <img src="docs/screenshots/readme-home-flare.png" alt="Home · Flare" width="280" />
  <img src="docs/screenshots/readme-home-citrus.png" alt="Home · Citrus" width="280" />
</p>
<p align="center">
  <sub>Prism · Flare · Citrus</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-home-candy.png" alt="Home · Candy" width="280" />
</p>
<p align="center">
  <sub>Candy</sub>
</p>

</details>

### Studio (AI generate)

**Studio** (`/studio`) is chat-primary: wide transcript, sticky radio preview, version history. Describe layout, sensors, and style; attach reference screenshots; refine with radio feedback. Legacy `/?chatId=` URLs redirect here.

<p align="center">
  <img src="docs/screenshots/readme-studio-dark.png" alt="Studio empty state in Dark theme" width="900" />
</p>

<p align="center">
  <sub>Studio · Dark</sub>
</p>

<details>
<summary>All Studio themes (19)</summary>

<p align="center">
  <img src="docs/screenshots/readme-studio-light.png" alt="Studio · Light" width="280" />
  <img src="docs/screenshots/readme-studio-dark.png" alt="Studio · Dark" width="280" />
  <img src="docs/screenshots/readme-studio-midnight.png" alt="Studio · Midnight" width="280" />
</p>
<p align="center">
  <sub>Light · Dark · Midnight</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-studio-slate.png" alt="Studio · Slate" width="280" />
  <img src="docs/screenshots/readme-studio-forest.png" alt="Studio · Forest" width="280" />
  <img src="docs/screenshots/readme-studio-ocean.png" alt="Studio · Ocean" width="280" />
</p>
<p align="center">
  <sub>Slate · Forest · Ocean</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-studio-contrast.png" alt="Studio · High contrast" width="280" />
  <img src="docs/screenshots/readme-studio-graphite.png" alt="Studio · Graphite" width="280" />
  <img src="docs/screenshots/readme-studio-meadow.png" alt="Studio · Meadow" width="280" />
</p>
<p align="center">
  <sub>High contrast · Graphite · Meadow</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-studio-fog.png" alt="Studio · Fog" width="280" />
  <img src="docs/screenshots/readme-studio-ember.png" alt="Studio · Ember" width="280" />
  <img src="docs/screenshots/readme-studio-volt.png" alt="Studio · Volt" width="280" />
</p>
<p align="center">
  <sub>Fog · Ember · Volt</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-studio-copper.png" alt="Studio · Copper" width="280" />
  <img src="docs/screenshots/readme-studio-aurora.png" alt="Studio · Aurora" width="280" />
  <img src="docs/screenshots/readme-studio-sunset.png" alt="Studio · Sunset" width="280" />
</p>
<p align="center">
  <sub>Copper · Aurora · Sunset</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-studio-prism.png" alt="Studio · Prism" width="280" />
  <img src="docs/screenshots/readme-studio-flare.png" alt="Studio · Flare" width="280" />
  <img src="docs/screenshots/readme-studio-citrus.png" alt="Studio · Citrus" width="280" />
</p>
<p align="center">
  <sub>Prism · Flare · Citrus</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-studio-candy.png" alt="Studio · Candy" width="280" />
</p>
<p align="center">
  <sub>Candy</sub>
</p>

</details>

### Templates

**Templates** (`/templates`) is a dedicated gallery with protocol filters. Primary action: **Open in Editor**. Secondary: jump to Studio for AI generation.

<p align="center">
  <img src="docs/screenshots/readme-templates-dark.png" alt="Templates gallery in Dark theme" width="900" />
</p>

<p align="center">
  <sub>Templates · Dark</sub>
</p>

<details>
<summary>All Templates themes (19)</summary>

<p align="center">
  <img src="docs/screenshots/readme-templates-light.png" alt="Templates · Light" width="280" />
  <img src="docs/screenshots/readme-templates-dark.png" alt="Templates · Dark" width="280" />
  <img src="docs/screenshots/readme-templates-midnight.png" alt="Templates · Midnight" width="280" />
</p>
<p align="center">
  <sub>Light · Dark · Midnight</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-templates-slate.png" alt="Templates · Slate" width="280" />
  <img src="docs/screenshots/readme-templates-forest.png" alt="Templates · Forest" width="280" />
  <img src="docs/screenshots/readme-templates-ocean.png" alt="Templates · Ocean" width="280" />
</p>
<p align="center">
  <sub>Slate · Forest · Ocean</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-templates-contrast.png" alt="Templates · High contrast" width="280" />
  <img src="docs/screenshots/readme-templates-graphite.png" alt="Templates · Graphite" width="280" />
  <img src="docs/screenshots/readme-templates-meadow.png" alt="Templates · Meadow" width="280" />
</p>
<p align="center">
  <sub>High contrast · Graphite · Meadow</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-templates-fog.png" alt="Templates · Fog" width="280" />
  <img src="docs/screenshots/readme-templates-ember.png" alt="Templates · Ember" width="280" />
  <img src="docs/screenshots/readme-templates-volt.png" alt="Templates · Volt" width="280" />
</p>
<p align="center">
  <sub>Fog · Ember · Volt</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-templates-copper.png" alt="Templates · Copper" width="280" />
  <img src="docs/screenshots/readme-templates-aurora.png" alt="Templates · Aurora" width="280" />
  <img src="docs/screenshots/readme-templates-sunset.png" alt="Templates · Sunset" width="280" />
</p>
<p align="center">
  <sub>Copper · Aurora · Sunset</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-templates-prism.png" alt="Templates · Prism" width="280" />
  <img src="docs/screenshots/readme-templates-flare.png" alt="Templates · Flare" width="280" />
  <img src="docs/screenshots/readme-templates-citrus.png" alt="Templates · Citrus" width="280" />
</p>
<p align="center">
  <sub>Prism · Flare · Citrus</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-templates-candy.png" alt="Templates · Candy" width="280" />
</p>
<p align="center">
  <sub>Candy</sub>
</p>

</details>

### Editor

**Editor** (`/editor`) uses an icon rail for app destinations so the canvas stays wide. Layers and Properties stay labeled. Insert prefabs, bind telemetry, validate, then **Export**.

<p align="center">
  <img src="docs/screenshots/readme-editor-dark.png" alt="Editor in Dark theme with whoop board, layers, and properties" width="900" />
</p>

<p align="center">
  <sub>Editor · Dark · whoop board</sub>
</p>

<details>
<summary>All Editor themes (19)</summary>

<p align="center">
  <img src="docs/screenshots/readme-editor-light.png" alt="Editor · Light" width="280" />
  <img src="docs/screenshots/readme-editor-dark.png" alt="Editor · Dark" width="280" />
  <img src="docs/screenshots/readme-editor-midnight.png" alt="Editor · Midnight" width="280" />
</p>
<p align="center">
  <sub>Light · Dark · Midnight</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-editor-slate.png" alt="Editor · Slate" width="280" />
  <img src="docs/screenshots/readme-editor-forest.png" alt="Editor · Forest" width="280" />
  <img src="docs/screenshots/readme-editor-ocean.png" alt="Editor · Ocean" width="280" />
</p>
<p align="center">
  <sub>Slate · Forest · Ocean</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-editor-contrast.png" alt="Editor · High contrast" width="280" />
  <img src="docs/screenshots/readme-editor-graphite.png" alt="Editor · Graphite" width="280" />
  <img src="docs/screenshots/readme-editor-meadow.png" alt="Editor · Meadow" width="280" />
</p>
<p align="center">
  <sub>High contrast · Graphite · Meadow</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-editor-fog.png" alt="Editor · Fog" width="280" />
  <img src="docs/screenshots/readme-editor-ember.png" alt="Editor · Ember" width="280" />
  <img src="docs/screenshots/readme-editor-volt.png" alt="Editor · Volt" width="280" />
</p>
<p align="center">
  <sub>Fog · Ember · Volt</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-editor-copper.png" alt="Editor · Copper" width="280" />
  <img src="docs/screenshots/readme-editor-aurora.png" alt="Editor · Aurora" width="280" />
  <img src="docs/screenshots/readme-editor-sunset.png" alt="Editor · Sunset" width="280" />
</p>
<p align="center">
  <sub>Copper · Aurora · Sunset</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-editor-prism.png" alt="Editor · Prism" width="280" />
  <img src="docs/screenshots/readme-editor-flare.png" alt="Editor · Flare" width="280" />
  <img src="docs/screenshots/readme-editor-citrus.png" alt="Editor · Citrus" width="280" />
</p>
<p align="center">
  <sub>Prism · Flare · Citrus</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-editor-candy.png" alt="Editor · Candy" width="280" />
</p>
<p align="center">
  <sub>Candy</sub>
</p>

</details>

### Insert prefabs

**Insert** lists modular Rotorflight and Betaflight / CRSF sections with cropped PNG previews, plus full-board actions (whoop, freestyle, dense CRSF, RF heli electric/nitro).

<p align="center">
  <img src="docs/screenshots/readme-insert-prefabs.png" alt="Editor Insert menu showing section prefabs" width="900" />
</p>

<p align="center">
  <sub>Insert · Dark · Quad sections</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-insert-light.png" alt="Insert · Light" width="280" />
  <img src="docs/screenshots/readme-insert-dark.png" alt="Insert · Dark" width="280" />
  <img src="docs/screenshots/readme-insert-ember.png" alt="Insert · Ember" width="280" />
</p>
<p align="center">
  <sub>Light · Dark · Ember</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-insert-volt.png" alt="Insert · Volt" width="280" />
  <img src="docs/screenshots/readme-insert-candy.png" alt="Insert · Candy" width="280" />
</p>
<p align="center">
  <sub>Volt · Candy</sub>
</p>

### Settings

**Settings** (`/settings`) replaces the old Preferences modal. Tabs: Appearance, AI providers, Simulator, Defaults.

<p align="center">
  <img src="docs/screenshots/readme-settings-themes.png" alt="Settings Appearance tab with theme cards" width="760" />
</p>

<p align="center">
  <sub>Settings · Appearance · Dark</sub>
</p>

Themes: Light, Dark, Midnight, Slate, Forest, Ocean, High contrast, Graphite, Meadow, Fog, Ember, Volt, Copper, Aurora, Sunset, Prism, Flare, Citrus, and Candy. The radio LCD canvas stays dark everywhere.

<details>
<summary>All Settings Appearance themes (19)</summary>

<p align="center">
  <img src="docs/screenshots/readme-settings-light.png" alt="Settings · Light" width="280" />
  <img src="docs/screenshots/readme-settings-dark.png" alt="Settings · Dark" width="280" />
  <img src="docs/screenshots/readme-settings-midnight.png" alt="Settings · Midnight" width="280" />
</p>
<p align="center">
  <sub>Light · Dark · Midnight</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-settings-slate.png" alt="Settings · Slate" width="280" />
  <img src="docs/screenshots/readme-settings-forest.png" alt="Settings · Forest" width="280" />
  <img src="docs/screenshots/readme-settings-ocean.png" alt="Settings · Ocean" width="280" />
</p>
<p align="center">
  <sub>Slate · Forest · Ocean</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-settings-contrast.png" alt="Settings · High contrast" width="280" />
  <img src="docs/screenshots/readme-settings-graphite.png" alt="Settings · Graphite" width="280" />
  <img src="docs/screenshots/readme-settings-meadow.png" alt="Settings · Meadow" width="280" />
</p>
<p align="center">
  <sub>High contrast · Graphite · Meadow</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-settings-fog.png" alt="Settings · Fog" width="280" />
  <img src="docs/screenshots/readme-settings-ember.png" alt="Settings · Ember" width="280" />
  <img src="docs/screenshots/readme-settings-volt.png" alt="Settings · Volt" width="280" />
</p>
<p align="center">
  <sub>Fog · Ember · Volt</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-settings-copper.png" alt="Settings · Copper" width="280" />
  <img src="docs/screenshots/readme-settings-aurora.png" alt="Settings · Aurora" width="280" />
  <img src="docs/screenshots/readme-settings-sunset.png" alt="Settings · Sunset" width="280" />
</p>
<p align="center">
  <sub>Copper · Aurora · Sunset</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-settings-prism.png" alt="Settings · Prism" width="280" />
  <img src="docs/screenshots/readme-settings-flare.png" alt="Settings · Flare" width="280" />
  <img src="docs/screenshots/readme-settings-citrus.png" alt="Settings · Citrus" width="280" />
</p>
<p align="center">
  <sub>Prism · Flare · Citrus</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-settings-candy.png" alt="Settings · Candy" width="280" />
</p>
<p align="center">
  <sub>Candy</sub>
</p>

</details>

<p align="center">
  <img src="docs/screenshots/readme-settings-ai-dark.png" alt="Settings AI providers tab" width="720" />
  &nbsp;
  <img src="docs/screenshots/readme-settings-simulator-dark.png" alt="Settings Simulator tab" width="720" />
</p>

<p align="center">
  <sub>AI providers · Simulator</sub>
</p>

### Simulator

From Editor, **Simulator** boots the WASM preview. Use **Open interactive sim** for touch, keys, and sticks (Esc to close). Firmware downloads live under **Settings → Simulator** (same assets as `npm run sync-wasm`).

<p align="center">
  <img src="docs/screenshots/readme-sim.png" alt="Run in simulator modal with WASM preview stage" width="760" />
</p>

<p align="center">
  <sub>Simulator · Dark</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-sim-dark.png" alt="Simulator · Dark" width="280" />
  <img src="docs/screenshots/readme-sim-light.png" alt="Simulator · Light" width="280" />
  <img src="docs/screenshots/readme-sim-midnight.png" alt="Simulator · Midnight" width="280" />
</p>
<p align="center">
  <sub>Dark · Light · Midnight</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-sim-volt.png" alt="Simulator · Volt" width="280" />
</p>
<p align="center">
  <sub>Volt</sub>
</p>

## What you get

1. Home library for projects and quick starts
2. Studio chat to describe layout, sensors, colors, and options
3. An agent that writes `main.lua` (and optional companion scripts)
4. Validation against EdgeTX rules and your telemetry protocol
5. A **Preview** that runs real EdgeTX firmware in the browser (WASM)
6. A visual **Editor** for fine-tuning draw objects
7. An **Export Sheet** with zip download + install guide
8. Optional **desktop** builds (Windows / Linux / macOS) via Tauri 2

## Quick start

**You need:** Node.js **22.13+** and an AI API key ([Cursor](https://cursor.com/dashboard/integrations), Anthropic, OpenAI, or Gemini). Export the matching env var, or add the key later under **Settings → AI**.

```bash
npm install
npm run setup    # stubs, WASM firmware, simulator patch (first time)
export CURSOR_API_KEY="cursor_..."   # PowerShell: $env:CURSOR_API_KEY="cursor_..."
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → Home. Start from Studio, Templates, or a blank Editor board.

The first WASM preview load is about 5 MB of EdgeTX firmware (cached afterward). Manage it under **Settings → Simulator**.

Refresh README screenshots (optional):

```bash
npm run dev   # in one terminal
E2E_BASE_URL=http://127.0.0.1:3000 npm run capture:readme
```

Captures every primary surface (Home, Studio, Templates, Editor, Settings) in all 19 themes, plus Insert / Simulator overlays.

## Using the web UI

| Area          | Route        | What it does                                            |
| ------------- | ------------ | ------------------------------------------------------- |
| **Home**      | `/`          | Project library + AI / Templates / Blank quick starts   |
| **Studio**    | `/studio`    | AI chat, version history, sticky radio preview          |
| **Editor**    | `/editor`    | Visual layout: layers, properties, Insert, Export Sheet |
| **Templates** | `/templates` | Full gallery with protocol filters                      |
| **Settings**  | `/settings`  | Appearance, AI providers, Simulator WASM, Defaults      |
| **Export**    | Sheet        | Validate → package → download zip / install guide       |

## Desktop app (Tauri)

```bash
npm run desktop:dev       # Next.js + native window
npm run desktop:prepare   # Next standalone + WASM for packaging
npm run desktop:build     # Native installer (needs platform toolchains)
```

Desktop packages are built **manually** from **Actions → Desktop packages → Run workflow** (not on every merge to `main`). Each green run uploads installers under **Actions → Artifacts** (`edgetx-dashboards-<os>`), and can refresh the `desktop-nightly` prerelease. Push a `desktop-v*` tag for a stable release.

See [desktop docs](docs/reference/desktop-tauri.md). Release sidecars currently expect Node 22+ on PATH (or `EDGETX_NODE_PATH`).

## Put it on your radio

1. Export / Download the zip from Studio or Editor
2. Copy `WIDGETS/<WidgetName>/` to your SD card
3. On the radio: **Model → Telemetry → Discover new** (power the FC / receiver first)
4. Add the widget to your main view, then go **full screen** (double-tap on TX15)
5. Read `INSTALL.md` in the zip for protocol-specific notes (Rotorflight needs `rf2bg`, etc.)

## CLI (optional)

```bash
export CURSOR_API_KEY="cursor_..."
npm run generate -- --protocol betaflight "Full-screen battery and GPS dashboard"
```

Useful flags: `--radio tx15`, `--protocol betaflight|rotorflight|generic-crsf`, `--edge-tx 2.11.0`.

## Telemetry protocols

| Protocol     | Catalog                                     | Notes                              |
| ------------ | ------------------------------------------- | ---------------------------------- |
| Betaflight   | `knowledge/telemetry/betaflight-crsf.json`  | Standard CRSF via ELRS / Crossfire |
| Rotorflight  | `knowledge/telemetry/rotorflight-crsf.json` | Needs `rf2bg` for custom sensors   |
| Generic CRSF | `knowledge/telemetry/generic-crsf.json`     | Common ELRS / CRSF sensor names    |

## Validation

Nothing ships until the widget passes checks:

- Widget structure (`name`, `create`, `refresh`, no `require` / `dofile`)
- Sensor names match the protocol catalog
- EdgeTX LCD API rules (including dev-kit stubs)
- Agent must get `valid: true` from `validateWidget` before packaging

Failed validation blocks download (HTTP 422). Fix in Studio or the Editor, then try again.

## If preview or sim breaks

| Symptom                              | Try this                                              |
| ------------------------------------ | ----------------------------------------------------- |
| Stuck on "Booting EdgeTX preview..." | Restart `npm run dev`, hard-refresh the browser       |
| WASM 404 / Settings incomplete       | `npm run sync-wasm` or Settings → Download firmware   |
| `simuAuxSerialStart` errors          | `npm run setup:sim`, restart dev server               |
| After changing `packages/*`          | Restart the dev server (packages compile from source) |

## Project layout

```text
apps/web/               Next.js UI (shadcn + Tailwind v4) and API routes
apps/desktop/           Tauri 2 desktop shell + standalone sidecar
packages/generator/     Cursor SDK agent, validation, packaging
packages/shared/        Shared types and @simulate layouts
packages/sim-preview/   EdgeTX WASM runtime and telemetry bridge
packages/layout-verify/ Static Lua draw interpreter and overlap checks
packages/editor-core/   Lua document model behind the visual editor
knowledge/              Radio profiles, telemetry catalogs, design guides
docs/design/wireframes/ UI/UX IA proposals (low-fi)
templates/              Starter Lua and INSTALL.md template
examples/               Reference widgets
apps/web/public/sim/    EdgeTX WASM firmware (auto-fetched)
generated/              Agent output (gitignored)
```

Packages are consumed as TypeScript source. Only the web app (and desktop packaging) have a build step.

More detail: [docs/README.md](docs/README.md) · [workspace layout](docs/reference/workspace-layout.md) · [scripts](docs/reference/scripts.md) · [wireframes](docs/design/wireframes/index.html)

## Environment variables

| Variable                          | Required | Description                                                                |
| --------------------------------- | -------- | -------------------------------------------------------------------------- |
| `CURSOR_API_KEY`                  | Yes*     | Cursor API key for generation (*or Settings → AI)                          |
| `ANTHROPIC_API_KEY`               | No*      | Anthropic key when provider is Anthropic                                   |
| `OPENAI_API_KEY`                  | No*      | OpenAI key when provider is OpenAI                                         |
| `GEMINI_API_KEY`                  | No*      | Gemini key when provider is Gemini                                         |
| `GENERATOR_API_SECRET`            | No†      | Required for non-loopback API access (†same-origin UI still works)         |
| `GENERATOR_ALLOW_UNAUTHENTICATED` | No       | Set to `1` only for intentional open LAN demos (never with server AI keys) |
| `EDGETX_WASM_BASE`                | No       | Override WASM firmware download base URL                                   |
| `SKIP_WASM_SYNC`                  | No       | Set to `1` to skip WASM download on install/dev                            |
| `WIDGET_GEN_DATA_DIR`             | No       | Override data dir (desktop sidecar uses app data)                          |
| `EDGETX_NODE_PATH`                | No       | Node binary for desktop release sidecar                                    |

## Security & contributing

- Local / desktop on localhost is the supported default. See [SECURITY.md](SECURITY.md) before hosting on the public internet.
- Contributions: [CONTRIBUTING.md](CONTRIBUTING.md) · [Code of Conduct](CODE_OF_CONDUCT.md).

## License

MIT. See [LICENSE](LICENSE). EdgeTX simulator firmware is GPLv2 — see [NOTICE.md](NOTICE.md).
