# WASM Runtime Preview — Implementation Notes

**Status:** Implemented (Radio sim tab in web UI)

**Date:** 2026-07-05

## Summary

Radio sim runs **EdgeTX 2.11 WASM firmware** for RadioMaster TX15 (480×320) in a Web Worker, using `@edgetx/simulator-ui` `WasmRunner` (same stack as [EdgeTX Dev Kit](https://github.com/JeffreyChix/edgetx-dev-kit)). **Preview tab** shows the live WASM framebuffer (cropped to `@simulate` zone); **Radio sim tab** opens the interactive overlay.

## Artifacts

| Item | Location |

|------|----------|

| WASM firmware | `apps/web/public/sim/edgetx-tx15-simulator.wasm` |

| Manifest (SHA256 pin) | `apps/web/public/sim/manifest.json` |

| Sync script | `npm run sync-wasm` → `scripts/sync-edgetx-wasm.mjs` |

| Runtime package | `packages/sim-preview` (`SimRuntime`, `virtualSd`, `telemetryBridge`) |

| Worker | `apps/web/src/workers/edgetxSim.worker.ts` |

| UI tab | **Radio sim** in `Preview480x320.tsx` |

**Download URL:** `https://ypwfws8ckruh03m1.public.blob.vercel-storage.com/wasm/edgetx-tx15-simulator.wasm`

**Pinned build:** EdgeTX **2.11** — sha256 `23d2e9060decc891e8518adf822d893fcb8333624ece8c8fa7629795176065a5` (5303067 bytes). As of 2026-07-05, the blob host serves the same file for `EDGETX_WASM_VERSION=2.12`; no newer TX15 WASM was available to pin.

## Boot sequence (mirrors Dev Kit)

1. `WasmRunner.initFs("tx15")` — OPFS virtual SD

2. `WasmRunner.load("/sim/edgetx-tx15-simulator.wasm")`

3. `simuInit()` → `simuFatfsSetPaths("/", "/")` → `simuCreateDefaults()` → deploy `/MODELS/model1.yml` (CRSF sensors + pre-assigned `screenData` for `@simulate` zone) → `simuStart(0)`

4. Write `WIDGETS/<Name>/main.lua` + `MODELS/model.png` via `fsWriteFile`

5. After ~12 frames of CRSF priming: `simuLoadWidgetByLayout(name, layout, zone)` once when `@simulate` is present (matches Dev Kit); `simuLoadWidget(name)` only when no zone annotation. Model YAML is backed up before inject and restored on dispose.

6. Inject CRSF telemetry each tick via `simuSendTelemetry(mod, 2, …)` (extra bursts while priming before widget load)

7. Interactive overlay auto-opens when boot completes. User input (touch, keys, sticks, switches) forwarded from `@edgetx/simulator-ui` `Simulator` → worker → `SimRuntime.handleInput()` → WASM exports. Full-LCD `@simulate` zones auto double-tap for widget fullscreen (30-frame wait, up to 2 attempts, touch at LCD center 240×160); partial zones use zone rect center on the 480×320 framebuffer. Manual **Enter widget fullscreen** button replays the gesture.

## Preview vs Radio sim (LCD API parity)

| API                                 | Preview (regex) | Radio sim (WASM)                                            |
| ----------------------------------- | --------------- | ----------------------------------------------------------- |
| drawFilledRect / drawLine / drawArc | Approximate     | Native                                                      |
| drawAnnulus / drawGauge             | Approximate     | Native **after widget fullscreen**; pinned EdgeTX 2.11      |
| drawBitmap                          | Placeholder     | Native PNG from virtual SD (`MODELS/model.png`, 56×40 grey) |
| getValue / getSourceIndex           | Mock            | CRSF + model sensors (incl. TQLY downlink LQ)               |

Manual QA: load `packages/sim-preview/src/__tests__/fixtures/drawAnnulusQa.lua` or a widget like `BfFltLoglk` in Radio sim and confirm the center annulus renders after fullscreen.

## WASM exports (reference)

From EdgeTX `wasmsimulatorinterface.h` / Dev Kit `simulatorHost.ts`:

- `simuInit`, `simuStart`, `simuStop`, `simuFatfsSetPaths`, `simuCreateDefaults`

- `simuLcdCopy`, `simuLcdGetWidth/Height/Depth`, `simuLcdFlushed`

- `simuSendTelemetry(mod, protocol, ptr, len)` — protocol `2` = CRSF

- `simuLoadWidget`, `simuLoadWidgetByLayout` — widget auto-launch after first frame

## Browser requirements

- **SharedArrayBuffer:** Next.js sets `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` in `next.config.mjs`

- First Radio sim tab open triggers WASM download (~5–15 MB); browser caches thereafter

## Testing

- Default CI: `npm test` (unit tests for virtual SD + CRSF encoder)

- Optional: `npm run test:wasm` after `npm run sync-wasm` (manifest + file presence)

## Out of scope

- Building WASM from EdgeTX source in CI

- Blocking widget download on WASM validation

- Audio output from WASM firmware
