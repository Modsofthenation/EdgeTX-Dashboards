# Dashboard Generator — domain context

EdgeTX **Lua widgets** run on radio transmitters (e.g. RadioMaster TX15) and draw telemetry on the main screen. This monorepo generates those widgets from natural-language prompts via an AI coding agent (Cursor SDK by default; other providers are supported).

## Packages

| Package                     | Role                                                                                                           |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `@widget-gen/shared`        | Shared types (`StreamEvent`, `GenerateRequest`, draw commands, validation issues), `@simulate` layout profiles |
| `@widget-gen/generator`     | Agent orchestration, prompts, validation, zip packaging, CLI                                                   |
| `@widget-gen/layout-verify` | Static Lua draw interpreter, overlap and geometry checks                                                       |
| `@widget-gen/sim-preview`   | EdgeTX WASM runtime, virtual SD card, CRSF telemetry bridge                                                    |
| `@widget-gen/editor-core`   | Lua ↔ scene document model behind the visual editor                                                            |
| `@widget-gen/web`           | Next.js chat UI, SQLite chat history, Lua preview, API routes                                                  |

## Key flows

1. **Generate** — `POST /api/generate` opens an SSE stream. The generator agent writes `generated/<name>/main.lua`, validates it, and the route emits a single terminal `done` via `emitRunCompletion()`.
2. **Refine** — `POST /api/refine` continues an existing session with follow-up prompts.
3. **Preview** — Home Preview uses EdgeTX WASM when firmware is mapped for the radio; otherwise `luaPreviewEngine` parses a subset of Lua against mock telemetry. The layout editor defaults to radio WASM pixels with a parser overlay for selection.
4. **Download** — `GET /api/download` returns a zip with `WIDGETS/<name>/main.lua` and generated `INSTALL.md`.

## Glossary

- **Widget** — A folder under `WIDGETS/<name>/` on the SD card; `main.lua` is the entry point. Name ≤ 10 characters.
- **Protocol** — Telemetry source: `betaflight`, `rotorflight`, or `generic-crsf`. Drives sensor names and prompt hints.
- **Radio profile** — LCD size, touch, layout (`knowledge/radios/*.json`). Default: `tx15` (480×320).
- **Layout archetype** — Prompt routing hint (`card-grid`, `heli-rotorflight`, etc.) in `layoutArchetype.ts`.
- **Visual style** — Color/vibrancy hints from `visualStyle.ts` appended to the agent prompt.
- **Session** — In-memory generator state (protocol, widget name, validation) keyed by `sessionId` until TTL expires.
- **StreamEvent** — Unified SSE payload shape (`text`, `tool`, `todo`, `status`, `error`, `done`, `widget`).

## Data paths

- `WIDGET_GEN_DATA_DIR` — Override for SQLite (`chats.db`) and runtime data (default: `<repo>/data`).
- `generated/` — Generated Lua source tree (agent workspace).
- `dist-output/` — Built zip artifacts for download.

## Server seams (web)

- `apps/web/src/server/generatorFacade.ts` — Only place API routes import `@widget-gen/generator`.
- `apps/web/src/lib/generationStreamClient.ts` — SSE parser for the browser.
- `apps/web/src/lib/db/chatRepository.ts` — Chat persistence interface; SQLite impl in `sqliteChatRepository.ts`, wired up in `chatStore.ts`.
