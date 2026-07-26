# Desktop app (Tauri 2)

EdgeTX Dashboards can run as a native desktop window on Linux, Windows, and macOS using [Tauri 2](https://v2.tauri.app/).

## Modes

- **`npm run desktop:dev`** — Next.js + Tauri webview on `http://localhost:3000`
- **`npm run desktop:prepare`** — Build Next `standalone`, stage WASM + static assets into `apps/desktop/resources/standalone`
- **`npm run desktop:build`** — Runs prepare, then packs a native installer with `$RESOURCE/standalone/` sidecar resources
- **`npm run desktop:smoke`** — After prepare, probe `WIDGET_GEN_REPO_ROOT` + staged `knowledge/` (catches installer root bugs)
- **`npm run verify:standalone -w @widget-gen/desktop`** — After a build, assert `standalone/apps/web/server.js` is bundled (not `_up_/`)

First launch without a Cursor API key shows a one-time Preferences wizard (`FirstRunWizard`). Stable desktop cuts use `desktop-v*` tags after smoke passes on `main`.

Release builds spawn `node apps/web/server.js` from bundled resources, wait for `/api/health`, then navigate the webview to `http://127.0.0.1:<port>/`. Chat SQLite data goes under the OS app-data dir (`WIDGET_GEN_DATA_DIR`). Generator assets (`knowledge/`, templates, stubs, …) are staged into the standalone bundle and copied on launch into a writable `WIDGET_GEN_REPO_ROOT` workspace so AI generate can run offline from installer resources.

## Prerequisites

- **All:** Rust **1.85+** via rustup, Node **22+**
- **Linux:** `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `librsvg2-dev`, `patchelf`
- **macOS:** Xcode CLT
- **Windows:** WebView2 + MSVC build tools

Release sidecars embed a portable Node under `$RESOURCE/node/` (override with `EDGETX_NODE_PATH` if needed).

## Why not static export?

Tauri’s Next.js guide assumes `output: 'export'`. This app needs API routes, SQLite, and WASM, so production uses Next **standalone** as a sidecar instead.

## CI packages (manual)

Trigger builds from **Actions → Desktop packages → Run workflow** (not on every merge to `main`). Optional input refreshes the `desktop-nightly` prerelease. Native installers:

- macOS arm64 + x64
- Linux x64 (`ubuntu-22.04`)
- Windows x64

Artifacts upload to the workflow run. Push a `desktop-v*` tag for a stable GitHub Release.

See [docs/reference/desktop-tauri.md](../../docs/reference/desktop-tauri.md).
