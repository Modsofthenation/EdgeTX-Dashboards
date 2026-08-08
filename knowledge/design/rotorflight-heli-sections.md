# Rotorflight heli → TX15 prefab sections

Modular dashboard blocks for **Rotorflight heli** boards on **RadioMaster TX15 (480×320)** with direct `lcd.*` calls.

> **Important:** Some community heli dashboards target **800×480** and use **LVGL**. These prefabs are a TX15-compatible information architecture — not a 1:1 port of any third-party widget. Flight logging, battery voice packs, and motor-switch gating are available as optional companion suites when the user asks.

## Telemetry requirements (call out to users)

Custom Rotorflight CRSF sensors need:

1. **Special Function → rf2bg** with **Repeat: On**
2. Telemetry page → **Delete all** → **Discover new** with FC + RX powered
3. Restart the radio if values stay at zero after first discovery

| Prefab need     | Catalog name    | Common radio aliases | Notes                        |
| --------------- | --------------- | -------------------- | ---------------------------- |
| Link quality    | `RQLY`          | `RQly`, `LQ`         | Standard CRSF                |
| Headspeed       | `HSpd`          | `Hspd`               | Requires rf2bg               |
| Tail RPM        | `Tspd`          | —                    | Optional custom CRSF         |
| Current         | `Curr`          | —                    | Standard                     |
| Cell voltage    | `Vcel`          | —                    | Custom CRSF                  |
| BEC voltage     | `Vbec`          | —                    | Custom CRSF                  |
| ESC temperature | `EscT`          | `Tesc`               | Custom CRSF                  |
| Governor / mode | `Gov` or `FM`   | —                    | Prefer `Gov` when discovered |
| Pack voltage    | `RxBt` / `Vbat` | —                    | Standard / custom            |

**Nitro / OMP variants:** Use Insert → **RF heli nitro board** (`rf-nitro-pack-tiles` + `rf-nitro-rx-bar`) when the user asks for nitro/OMP. Headspeed still uses `HSpd` (alias `NR`). Gallery prompts for nitro remain available on Generate.

## Prefab ids (electric TX15 order)

1. `rf-topbar-link`
2. `rf-model-panel`
3. `rf-governor-card`
4. `rf-headspeed-hero`
5. `rf-motor-tiles`
6. `rf-battery-bar`

Nitro substitutes: `rf-nitro-pack-tiles`, `rf-nitro-rx-bar`.

## Agent / editor guidance

- When the user asks for a Rotorflight heli board, **compose from these prefab ids** instead of inventing a new grid.
- Prefer catalog sensor names above; document aliases in INSTALL.md when helpful.
- Keep draw calls as direct `lcd.*` in `refresh()` for web preview.

## Live radio enrich

When Live is on for Rotorflight, the app may **preview-enrich** missing HSpd/Gov/Vbec/… so heli boards stay readable. That fill is **synthetic for the preview** — not true FC sensor values. For real numbers: Special Function → rf2bg (Repeat On) → Telemetry → Discover new, then bind those catalog names in the widget.
