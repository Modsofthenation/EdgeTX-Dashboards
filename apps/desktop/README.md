# Desktop app (Tauri)

EdgeTX Dashboards can run as a native desktop window on Linux, Windows, and macOS using [Tauri 2](https://v2.tauri.app/).

## Why Tauri (not Electron)

- Small binaries (uses the OS webview)
- Same web UI as `apps/web`
- Cross-platform packaging from one Rust + web codebase

## Important constraint

Official Tauri + Next.js docs assume `output: 'export'` (static HTML). This project **cannot** static-export today: it depends on Next API routes, SQLite chat history, and EdgeTX WASM. The desktop app therefore:

1. **Dev** — Tauri webview loads `http://localhost:3000` while Next runs (`beforeDevCommand`).
2. **Prod (current)** — ships a fallback page + docs; treat the shell as a native window around a running/local server.
3. **Prod (planned)** — bundle Next.js `output: 'standalone'` as a Tauri sidecar and navigate the webview to `http://127.0.0.1:<port>`.

## Prerequisites

Follow [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS:

- **All:** Rust **1.85+** via [rustup](https://rustup.rs/) (Tauri 2.11 needs edition2024-capable rustc), Node 22+
- **Linux:** `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `librsvg2-dev`, `patchelf`
- **macOS:** Xcode CLT
- **Windows:** WebView2 (usually preinstalled), MSVC build tools

Ensure `rustc --version` is 1.85+ after `rustup default stable` (some environments still point `PATH` at an older `/usr/local/cargo/bin/rustc`).

## Commands

From the repo root:

```bash
# Install workspace deps (includes @tauri-apps/cli in apps/desktop)
npm install

# Dev: Next.js + native window
npm run desktop:dev

# Build native installers (requires OS toolchain; see note above)
npm run desktop:build
```

Or from `apps/desktop`:

```bash
npm run tauri -- dev
npm run tauri -- build
```

## Layout

```
apps/desktop/
  package.json              # @widget-gen/desktop
  scripts/prepare-fallback.mjs
  src-tauri/
    tauri.conf.json         # window + bundle config
    Cargo.toml
    capabilities/
    icons/
    fallback/index.html     # used when no Next server is embedded yet
```

## Next steps for full offline desktop

1. Enable Next `output: 'standalone'` for release builds only.
2. Add a Tauri sidecar that starts the standalone Node server on a free port.
3. Point the webview at that port after health-check.
4. Ship platform installers via CI (`tauri-apps/tauri-action`).
