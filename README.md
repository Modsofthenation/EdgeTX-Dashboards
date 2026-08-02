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
- **Thirteen UI themes** (LCD canvas stays dark in every theme)
- **Settings → AI** for a browser API key or server `CURSOR_API_KEY` / Anthropic / OpenAI / Gemini
- Desktop installers for **Windows / macOS / Linux** (manual Actions workflow)

## Tour

### Home library

The app opens on **Home** (`/`): recent projects plus three equal entry paths — **AI Studio**, **Templates**, and **Blank / Import**.

<p align="center">
  <img src="docs/screenshots/readme-home-light.png" alt="Home library in Light theme" width="720" />
</p>

<p align="center">
  <sub>Home · Light</sub>
</p>

### Studio (AI generate)

**Studio** (`/studio`) is chat-primary: wide transcript, sticky radio preview, version history. Describe layout, sensors, and style; attach reference screenshots; refine with radio feedback. Legacy `/?chatId=` URLs redirect here.

<p align="center">
  <img src="docs/screenshots/readme-studio-dark.png" alt="Studio empty state in Dark theme" width="900" />
</p>

<p align="center">
  <sub>Studio · Dark</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-studio-ocean.png" alt="Studio in Ocean theme" width="720" />
  &nbsp;
  <img src="docs/screenshots/readme-studio-midnight.png" alt="Studio in Midnight theme" width="720" />
</p>

<p align="center">
  <sub>Ocean · Midnight</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-studio-light.png" alt="Studio in Light theme" width="720" />
  &nbsp;
  <img src="docs/screenshots/readme-studio-ember.png" alt="Studio in Ember theme" width="720" />
</p>

<p align="center">
  <sub>Light · Ember</sub>
</p>

### Templates

**Templates** (`/templates`) is a dedicated gallery with protocol filters. Primary action: **Open in Editor**. Secondary: jump to Studio for AI generation.

<p align="center">
  <img src="docs/screenshots/readme-templates-dark.png" alt="Templates gallery in Dark theme" width="900" />
</p>

<p align="center">
  <sub>Templates · Dark</sub>
</p>

### Editor

**Editor** (`/editor`) uses an icon rail for app destinations so the canvas stays wide. Layers and Properties stay labeled. Insert prefabs, bind telemetry, validate, then **Export**.

<p align="center">
  <img src="docs/screenshots/readme-editor-dark.png" alt="Editor in Dark theme with whoop board, layers, and properties" width="900" />
</p>

<p align="center">
  <sub>Editor · Dark · whoop board</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-editor-forest.png" alt="Editor in Forest theme" width="720" />
  &nbsp;
  <img src="docs/screenshots/readme-editor-midnight.png" alt="Editor in Midnight theme" width="720" />
</p>

<p align="center">
  <sub>Forest · Midnight</sub>
</p>

<p align="center">
  <img src="docs/screenshots/readme-editor-light.png" alt="Editor in Light theme" width="720" />
  &nbsp;
  <img src="docs/screenshots/readme-editor-slate.png" alt="Editor in Slate theme" width="720" />
</p>

<p align="center">
  <sub>Light · Slate</sub>
</p>

### Insert prefabs

**Insert** lists modular Rotorflight and Betaflight / CRSF sections with cropped PNG previews, plus full-board actions (whoop, freestyle, dense CRSF, RF heli electric/nitro).

<p align="center">
  <img src="docs/screenshots/readme-insert-prefabs.png" alt="Editor Insert menu showing section prefabs" width="900" />
</p>

<p align="center">
  <sub>Insert · prefabs</sub>
</p>

### Settings

**Settings** (`/settings`) replaces the old Preferences modal. Tabs: Appearance, AI providers, Simulator, Defaults.

<p align="center">
  <img src="docs/screenshots/readme-settings-themes.png" alt="Settings Appearance tab with theme cards" width="760" />
</p>

<p align="center">
  <sub>Settings · Appearance</sub>
</p>

Themes: Light, Dark, Midnight, Slate, Forest, Ocean, High contrast, Graphite, Meadow, Fog, Ember, Volt, and Copper. The radio LCD canvas stays dark everywhere.

### Simulator

From Editor, **Simulator** boots the WASM preview. Use **Open interactive sim** for touch, keys, and sticks (Esc to close). Firmware downloads live under **Settings → Simulator** (same assets as `npm run sync-wasm`).

<p align="center">
  <img src="docs/screenshots/readme-sim.png" alt="Run in simulator modal with WASM preview stage" width="760" />
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
E2E_BASE_URL=http://127.0.0.1:3000 npx tsx scripts/capture-readme-screenshots.ts
```

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

| Variable               | Required | Description                                       |
| ---------------------- | -------- | ------------------------------------------------- |
| `CURSOR_API_KEY`       | Yes*     | Cursor API key for generation (*or Settings → AI) |
| `ANTHROPIC_API_KEY`    | No*      | Anthropic key when provider is Anthropic          |
| `OPENAI_API_KEY`       | No*      | OpenAI key when provider is OpenAI                |
| `GEMINI_API_KEY`       | No*      | Gemini key when provider is Gemini                |
| `GENERATOR_API_SECRET` | No       | Protects API routes when set                      |
| `SKIP_WASM_SYNC`       | No       | Set to `1` to skip WASM download on install/dev   |
| `WIDGET_GEN_DATA_DIR`  | No       | Override data dir (desktop sidecar uses app data) |
| `EDGETX_NODE_PATH`     | No       | Node binary for desktop release sidecar           |

## License

MIT. See [LICENSE](LICENSE).
