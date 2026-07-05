# WASM Runtime Preview — Implementation Notes



**Status:** Implemented (Radio sim tab in web UI)  

**Date:** 2026-07-05



## Summary



Radio sim runs **EdgeTX 2.11 WASM firmware** for RadioMaster TX15 (480×320) in a Web Worker, using `@edgetx/simulator-ui` `WasmRunner` (same stack as [EdgeTX Dev Kit](https://github.com/JeffreyChix/edgetx-dev-kit)). Fast regex preview remains the default.



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



## Boot sequence (mirrors Dev Kit)



1. `WasmRunner.initFs("tx15")` — OPFS virtual SD

2. `WasmRunner.load("/sim/edgetx-tx15-simulator.wasm")`

3. `simuInit()` → `simuFatfsSetPaths("/", "/")` → `simuCreateDefaults()` → `simuStart(0)`

4. Write `WIDGETS/<Name>/main.lua` + `MODELS/model.png` via `fsWriteFile`

5. On first LCD frame: `simuLoadWidgetByLayout(name, layout, zone)` when `@simulate` is present (matches Dev Kit); `simuLoadWidget(name)` only when no zone annotation

6. After `simuCreateDefaults()`, overwrite `/MODELS/model1.yml` with a CRSF model + Betaflight sensor labels, then inject CRSF telemetry to internal and external module bays via `simuSendTelemetry(mod, 2, …)` (~60 frames before first widget load, reload once after ~45 more frames so `create()` re-caches `getSourceIndex()`)

7. User input (touch, keys, sticks, switches) forwarded from `@edgetx/simulator-ui` `Simulator` → worker → `SimRuntime.handleInput()` → WASM exports. Double-tap the widget on the LCD to enter widget fullscreen (same as on hardware).



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

