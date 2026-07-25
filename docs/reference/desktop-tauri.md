# Desktop shell (Tauri 2)

Native desktop packaging for EdgeTX Dashboards using [Tauri 2](https://v2.tauri.app/).

## Status

| Mode                    | Behavior                                                              |
| ----------------------- | --------------------------------------------------------------------- |
| `npm run desktop:dev`   | Starts Next.js and opens a Tauri window on `http://localhost:3000`    |
| `npm run desktop:build` | Builds a native shell with a fallback page (Next is not embedded yet) |

Static export is **not** used: the web app needs API routes, SQLite, and WASM. See `apps/desktop/README.md` for the planned standalone sidecar.

## Platforms

Tauri targets Linux, Windows, and macOS from the same `apps/desktop` crate. Install [platform prerequisites](https://v2.tauri.app/start/prerequisites/), then:

```bash
npm run desktop:dev
```
