# Desktop shell (Tauri 2)

Native desktop packaging for EdgeTX Dashboards using [Tauri 2](https://v2.tauri.app/).

## Status

| Mode                      | Behavior                                                             |
| ------------------------- | -------------------------------------------------------------------- |
| `npm run desktop:dev`     | Starts Next.js and opens a Tauri window on `http://localhost:3000`   |
| `npm run desktop:prepare` | Builds Next `standalone` + copies WASM/static into desktop resources |
| `npm run desktop:build`   | Packages a native installer; release launches a local Next sidecar   |

Static export is **not** used. Production embeds a Next.js standalone server and navigates the webview after `/api/health` succeeds. Node 22+ must be available on PATH (or via `EDGETX_NODE_PATH`) for the sidecar.

## Preferences

In-app **Preferences** (Generate + Layout headers) covers:

- **Appearance** — multiple UI themes
- **Simulator WASM** — download / refresh EdgeTX TX15 firmware for radio preview

## CI packages (main)

GitHub Actions workflow [`.github/workflows/desktop.yml`](../../.github/workflows/desktop.yml) builds installers on every push/merge to `main` (path-filtered) and on `workflow_dispatch`:

| Runner           | Artifact                                 |
| ---------------- | ---------------------------------------- |
| `macos-latest`   | macOS arm64 + x64                        |
| `ubuntu-22.04`   | Linux x64 (deb/AppImage/rpm as produced) |
| `windows-latest` | Windows x64                              |

Outputs:

- **Actions artifacts** — `edgetx-dashboards-<os>` (30-day retention)
- **GitHub Release** — prerelease tag `desktop-nightly` (assets refreshed each run)

Versioned production releases can be added later via tags such as `desktop-v*`.

## Platforms

Install [platform prerequisites](https://v2.tauri.app/start/prerequisites/), then:

```bash
npm run desktop:dev
# or
npm run desktop:prepare && npm run desktop:build
```
