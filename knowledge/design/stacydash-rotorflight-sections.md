# StacyDash → TX15 Rotorflight prefab sections

Modular dashboard blocks distilled from **StacyDashV4** (community Rotorflight dashboard) and adapted for **RadioMaster TX15 (480×320)** with direct `lcd.*` calls.

> **Important:** Original StacyDash targets **800×480** and uses **LVGL**. These prefabs are a TX15-compatible information architecture — not a 1:1 port. Flight logging, battery voice packs, and motor-switch gating from StacyDash are intentionally omitted unless the user asks.

## Telemetry requirements (call out to users)

Custom Rotorflight CRSF sensors need:

1. **Special Function → rf2bg** with **Repeat: On**
2. Telemetry page → **Delete all** → **Discover new** with FC + RX powered
3. Restart the radio if values stay at zero after first discovery

| Prefab need     | Catalog name    | StacyDash / radio aliases | Notes                                   |
| --------------- | --------------- | ------------------------- | --------------------------------------- |
| Link quality    | `RQLY`          | `RQly`, `LQ`              | Standard CRSF                           |
| Headspeed       | `HSpd`          | `Hspd`                    | Requires rf2bg                          |
| Tail RPM        | `Tspd`          | —                         | Optional custom CRSF                    |
| Current         | `Curr`          | —                         | Standard                                |
| Pack voltage    | `RxBt` / `Vbat` | `Vbat` pack vs RxBt       | Prefer `Vbat` when present              |
| Cell voltage    | `Vcel`          | —                         | Custom CRSF                             |
| BEC voltage     | `Vbec`          | —                         | Custom CRSF                             |
| ESC temp        | `EscT`          | `Tesc`                    | Custom CRSF                             |
| Battery %       | `Bat%`          | Smart Fuel                | FC charge estimate                      |
| Capacity        | `Capa`          | —                         | mAh used                                |
| Governor / mode | `FM` / `Gov`    | `Gov` enum                | FM string always useful                 |
| Model image     | —               | `/IMAGES/<ModelName>.png` | Name must match RF Configurator exactly |

**Nitro / OMP variants:** Use Insert → **StacyDash nitro board** (`rf-nitro-pack-tiles` + `rf-nitro-rx-bar`) when the user asks for nitro/OMP. Headspeed still uses `HSpd` (alias `NR`). Gallery prompts for nitro remain available on Generate.

## Prefab ids (editor Insert → Rotorflight + AI)

| Id                    | Role                                            |
| --------------------- | ----------------------------------------------- |
| `rf-topbar-link`      | Header: title, timer, RQLY bars                 |
| `rf-model-panel`      | Left model / image placeholder + flights footer |
| `rf-governor-card`    | Governor / FM status                            |
| `rf-headspeed-hero`   | DBLSIZE headspeed + tail                        |
| `rf-motor-tiles`      | AMPS · CELL · BEC · ESC T                       |
| `rf-battery-bar`      | Bottom Bat% fuel bar                            |
| `rf-nitro-pack-tiles` | Nitro: RX V · CELL · BEC                        |
| `rf-nitro-rx-bar`     | Nitro: RX pack voltage bar                      |

Canonical TX15 assembly order (electric):

`rf-topbar-link` → `rf-model-panel` → `rf-governor-card` → `rf-headspeed-hero` → `rf-motor-tiles` → `rf-battery-bar`

Nitro order:

`rf-topbar-link` → `rf-model-panel` → `rf-governor-card` → `rf-headspeed-hero` → `rf-nitro-pack-tiles` → `rf-nitro-rx-bar`

## AI composition rules

- When the user asks for StacyDash / Kyle Stacy / Rotorflight heli board, **compose from these prefab ids** instead of inventing a new grid.
- Keep all `lcd.draw*` calls **directly in `refresh()`**.
- Cache sensors with `getSourceIndex` / `cacheSource` in `create()` using catalog names (`HSpd`, not `Hspd`).
- Zero handling: show `"--"` / `"---"` for missing headspeed/link — never leave misleading zeros as primary values.
- Do not add `io.*`, flight CSV logging, or `playFile` battery voices unless requested.

## Editor

Layout → Insert → **Rotorflight sections** inserts the same blocks the generator knows about.

Select any draw inside a prefab to edit that block’s **Prefab sensors** in Properties (defaults = hardcoded catalog names). Changing a sensor remaps `cacheSource("…")` for that src key only — refresh locals keep using `widget.src.<key>`. Expand **All telemetry sources** to edit every cached sensor on the widget.
