# Desktop app (Tauri 2)

EdgeTX Dashboards can run as a native desktop window on Linux, Windows, and macOS using [Tauri 2](https://v2.tauri.app/).

## Modes

- **`npm run desktop:dev`** — Next.js + Tauri webview on `http://localhost:3000`
- **`npm run desktop:prepare`** — Build Next `standalone`, stage WASM + static assets into `apps/desktop/resources/standalone`
- **`npm run desktop:build`** — Runs prepare, then packs a native installer with `$RESOURCE/standalone/` sidecar resources
- **`npm run verify:standalone -w @widget-gen/desktop`** — After a build, assert `standalone/apps/web/server.js` is bundled (not `_up_/`)

Release builds spawn `node apps/web/server.js` from bundled resources, wait for `/api/health`, then navigate the webview to `http://127.0.0.1:<port>/`. Chat SQLite data goes under the OS app-data dir (`WIDGET_GEN_DATA_DIR`).

## Prerequisites

- **All:** Rust **1.85+** via rustup, Node **22+**
- **Linux:** `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `librsvg2-dev`, `patchelf`
- **macOS:** Xcode CLT
- **Windows:** WebView2 + MSVC build tools

Release sidecars currently require **Node on PATH** (or `EDGETX_NODE_PATH`). Bundling a Node binary into the installer is a follow-up.

## Why not static export?

Tauri’s Next.js guide assumes `output: 'export'`. This app needs API routes, SQLite, and WASM, so production uses Next **standalone** as a sidecar instead.

## CI packages (main)

On each merge/push to `main` (and via **Actions → Desktop packages → Run workflow**), CI builds native installers for:

- macOS arm64 + x64
- Linux x64 (`ubuntu-22.04`)
- Windows x64

Artifacts upload to the workflow run; assets also refresh the `desktop-nightly` prerelease.

See [docs/reference/desktop-tauri.md](../../docs/reference/desktop-tauri.md).
