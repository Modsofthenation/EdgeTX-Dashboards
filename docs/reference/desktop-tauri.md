# Desktop shell (Tauri 2)

Native desktop packaging for EdgeTX Dashboards using [Tauri 2](https://v2.tauri.app/).

## Status

| Mode                      | Behavior                                                             |
| ------------------------- | -------------------------------------------------------------------- |
| `npm run desktop:dev`     | Starts Next.js and opens a Tauri window on `http://localhost:3000`   |
| `npm run desktop:prepare` | Builds Next `standalone` + copies WASM/static into desktop resources |
| `npm run desktop:build`   | Packages a native installer; release launches a local Next sidecar   |

Static export is **not** used. Production embeds a Next.js standalone server and navigates the webview after `/api/health` succeeds. A portable **Node 22** binary is fetched into `apps/desktop/resources/node/` during prepare and mapped to `$RESOURCE/node/` so installers do not require a system Node (override with `EDGETX_NODE_PATH` if needed).

`prepare-standalone.mjs` also stages generator filesystem assets (`knowledge/`, `templates/`, `examples/`, `stubs/`, `.cursor/rules/`) into the standalone tree. On launch, the Tauri shell copies those into a **writable** workspace under the OS app-data directory and sets:

| Env                        | Purpose                                                            |
| -------------------------- | ------------------------------------------------------------------ |
| `WIDGET_GEN_DATA_DIR`      | Chat SQLite + caches                                               |
| `WIDGET_GEN_REPO_ROOT`     | Writable workspace (knowledge + `generated/` for the Cursor agent) |
| `WIDGET_GEN_SIM_DIR`       | EdgeTX WASM sim assets                                             |
| `CURSOR_SANDBOX_ENABLED=0` | Disable Cursor sandbox (Windows sandbox needs WSL2)                |

Sidecar stdout/stderr are appended to `%AppData%/…/sidecar.log` (or the OS equivalent under the app data dir) so release GUI builds still leave diagnostics when chat generation fails.

Without `knowledge/`, `/api/generate` fails looking up the repo root (historically shown as a bare **Internal Server Error** in the chat UI).

`tauri.conf.json` maps `../resources/standalone/` → `standalone/` and `../resources/node/` → `node/` so release builds find `$RESOURCE/standalone/apps/web/server.js` plus the bundled Node binary. Do not use the array form `["../resources/standalone"]` — Tauri rewrites `../` to `_up_/`, which breaks the sidecar lookup.

## Preferences

In-app **Preferences** (Generate + Layout headers) covers:

- **Appearance** — multiple UI themes
- **Simulator WASM** — download / refresh EdgeTX TX15 firmware for radio preview

## IPC / ACL

The webview loads the Next.js sidecar from `http://localhost` / `127.0.0.1`, which Tauri treats as a **remote** origin. Custom Rust commands (`write_app_data_project`, dialog-owned save/open, SD install, …) must be listed in `src-tauri/build.rs` (`AppManifest::commands`) and allowed in `src-tauri/capabilities/default.json` (`allow-*`). Missing entries surface as `Command … not allowed by ACL` (e.g. project save sync).

## CI packages (manual)

GitHub Actions workflow [`.github/workflows/desktop.yml`](../../.github/workflows/desktop.yml) builds installers **on demand** (Actions → **Desktop packages** → **Run workflow**) and on `desktop-v*` tags. It does **not** run on every merge to `main` (saves Actions minutes).

| Runner           | Artifact               |
| ---------------- | ---------------------- |
| `macos-latest`   | macOS arm64 + x64 DMG  |
| `ubuntu-22.04`   | Linux x64 `.deb`       |
| `windows-latest` | Windows x64 NSIS + MSI |

Outputs (from each green run):

- **Actions artifacts** — `edgetx-dashboards-<os>` on the workflow run (30-day retention). Open the run → **Artifacts**.
- **GitHub Release (nightly)** — prerelease tag `desktop-nightly` (optional; enabled by default on manual runs via the `publish_nightly` input)
- **GitHub Release (stable)** — non-prerelease when a `desktop-v*` tag is pushed (e.g. `desktop-v1.2.0`)

### Cutting a stable desktop release

```bash
git tag desktop-v1.2.0
git push origin desktop-v1.2.0
```

That triggers the same matrix build as a manual run, then the `publish-release` job attaches installers to a normal (non-prerelease) GitHub Release named after the tag. Prefer these tagged builds when giving pilots a durable installer; use a manual run (or `desktop-nightly`) for occasional smoke builds.

## On the radio tonight

1. Open the **desktop app**.
2. **Generate** a board in chat (or open an existing chat), then switch to **Layout** to tweak.
3. Open the **Install wizard** → checklist (Rotorflight: enable **rf2bg** + Discover new).
4. **Pick SD** card folder → **Copy to SD card**.
5. Eject the SD safely, insert into the radio, add the widget full-screen.

## Platforms

Install [platform prerequisites](https://v2.tauri.app/start/prerequisites/), then:

```bash
npm run desktop:dev
# or
npm run desktop:prepare && npm run desktop:build
```
