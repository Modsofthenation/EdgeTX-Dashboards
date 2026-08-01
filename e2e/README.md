# End-to-end tests

Playwright suite for the EdgeTX Dashboard Generator web app. **Not wired into CI yet** — run locally (or in a cloud agent) before relying on new flows.

## Quick start

```bash
# from repo root (dev server is started automatically)
npm run test:e2e

# interactive UI mode
npm run test:e2e:ui

# optional live AI generation (needs a provider key)
E2E_AI_KEY=… E2E_AI_PROVIDER=cursor npm run test:e2e:ai
```

Chromium is required:

```bash
npx playwright install chromium
```

## What is covered

| Spec                      | Focus                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `01-api-smoke`            | Health, radios, models, AI status, chats CRUD, validate, widget-source, download zip, generate 503 gate, package files, install guide |
| `02-home-boot`            | Product chrome, empty state, first-run wizard, AI banner, composer, template filters                                                  |
| `03-preferences`          | Appearance themes, AI tab, Simulator WASM tab, persistence across Generate ↔ Layout                                                   |
| `04-templates-navigation` | Template → Layout, chrome navigation, protocol query params                                                                           |
| `05-editor-workflow`      | Insert / Validate / Save / Export / Simulator / More                                                                                  |
| `06-chat-history`         | Sidebar list, New chat, delete                                                                                                        |
| `07-validate-download`    | Validation gates, zip download from API + Export UI                                                                                   |
| `08-sim-firmware`         | WASM status API + Preferences panel + `/sim/manifest.json`                                                                            |
| `09-generate-gate`        | No-key generate UI + API errors                                                                                                       |
| `10-generate.ai`          | Optional live agent generate (skipped without key)                                                                                    |

Default project (`chromium`) clears server AI env keys so “not configured” paths are deterministic. Set `E2E_ALLOW_SERVER_AI=1` only when you intentionally want the webServer to inherit host keys.

## Isolation

- Uses `WIDGET_GEN_DATA_DIR=data/e2e` for SQLite / chat data
- Default port `3100` (`E2E_PORT` / `E2E_BASE_URL` override)
- `workers: 1` to avoid SQLite races
- Does **not** reuse an already-running Next server by default (avoids leaking host AI keys / wrong data dir). Opt in with `E2E_REUSE_SERVER=1`.

## Prerequisites

- Chromium via `npx playwright install chromium`
- For `08-sim-firmware` TX15 presence assertions: WASM synced (`npm install` / `npm run sync-wasm`). The suite soft-skips those checks when `/api/sim-firmware` reports `ready: false`.

## Adding tests

Prefer role + accessible name selectors. Seed widgets with `seedValidWidget()` from `helpers/api.ts` instead of calling the AI agent. Keep AI-only cases in `*.ai.spec.ts`.
