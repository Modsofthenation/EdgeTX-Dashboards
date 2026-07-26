# Desktop shell (Tauri 2)

Native desktop packaging for EdgeTX Dashboards using [Tauri 2](https://v2.tauri.app/).

## Status

| Mode                      | Behavior                                                             |
| ------------------------- | -------------------------------------------------------------------- |
| `npm run desktop:dev`     | Starts Next.js and opens a Tauri window on `http://localhost:3000`   |
| `npm run desktop:prepare` | Builds Next `standalone` + copies WASM/static into desktop resources |
| `npm run desktop:build`   | Packages a native installer; release launches a local Next sidecar   |

Static export is **not** used. Production embeds a Next.js standalone server and navigates the webview after `/api/health` succeeds. A portable **Node 22** binary is fetched into `apps/desktop/resources/node/` during prepare and mapped to `$RESOURCE/node/` so installers do not require a system Node (override with `EDGETX_NODE_PATH` if needed).

`tauri.conf.json` maps `../resources/standalone/` → `standalone/` and `../resources/node/` → `node/` so release builds find `$RESOURCE/standalone/apps/web/server.js` plus the bundled Node binary. Do not use the array form `["../resources/standalone"]` — Tauri rewrites `../` to `_up_/`, which breaks the sidecar lookup.

## Preferences

In-app **Preferences** (Generate + Layout headers) covers:

- **Appearance** — multiple UI themes
- **Simulator WASM** — download / refresh EdgeTX TX15 firmware for radio preview

## CI packages (main)

GitHub Actions workflow [`.github/workflows/desktop.yml`](../../.github/workflows/desktop.yml) builds installers on **every push/merge to `main`** and on `workflow_dispatch`:

| Runner           | Artifact               |
| ---------------- | ---------------------- |
| `macos-latest`   | macOS arm64 + x64 DMG  |
| `ubuntu-22.04`   | Linux x64 `.deb`       |
| `windows-latest` | Windows x64 NSIS + MSI |

Outputs (from each green run):

- **Actions artifacts** — `edgetx-dashboards-<os>` on the workflow run (30-day retention). Open the run → **Artifacts**.
- **GitHub Release (nightly)** — prerelease tag `desktop-nightly` (refreshed after all matrix jobs succeed on `main`)
- **GitHub Release (stable)** — non-prerelease when a `desktop-v*` tag is pushed (e.g. `desktop-v1.2.0`)

### Cutting a stable desktop release

```bash
git tag desktop-v1.2.0
git push origin desktop-v1.2.0
```

That triggers the same matrix build as `main`, then the `publish-release` job attaches installers to a normal (non-prerelease) GitHub Release named after the tag. Prefer these tagged builds when giving pilots a durable installer; use `desktop-nightly` only for continuous smoke-testing.

## Platforms

Install [platform prerequisites](https://v2.tauri.app/start/prerequisites/), then:

```bash
npm run desktop:dev
# or
npm run desktop:prepare && npm run desktop:build
```
