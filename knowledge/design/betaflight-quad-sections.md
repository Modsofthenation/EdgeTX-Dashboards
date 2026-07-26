# Betaflight / CRSF quad → TX15 prefab sections

Modular dashboard blocks for **whoop**, **freestyle**, and **dense CRSF** boards on **RadioMaster TX15 (480×320)** with direct `lcd.*` calls.

> **Important:** These prefabs capture common FPV dashboard information architecture (armed banner, dual bars, voltage/timer heroes, metric grids, GPS row) adapted to TX15. They are not ports of any third-party widget and use anonymous labels only.

## Telemetry requirements

| Prefab need   | Catalog name | Notes                                      |
| ------------- | ------------ | ------------------------------------------ |
| Link quality  | `RQLY`       | Standard CRSF                              |
| RSSI          | `1RSS`       | Optional secondary link                    |
| Pack voltage  | `RxBt`       | Standard                                   |
| Current       | `Curr`       | Standard                                   |
| Capacity used | `Capa`       | When FC reports mAh                        |
| Attitude      | `Ptch`/`Roll`| Needs attitude telemetry via CRSF          |
| GPS           | `Alt`/`GSpd`/`Sats` | Requires GPS on the model            |
| Flight mode   | `FM`         | Used for armed / mode footer               |

Configure model **timer 1** for timer heroes/cards.

## Prefab ids

**Whoop overview:** `quad-armed-banner` → `quad-link-batt-bars` → `quad-voltage-hero` → `quad-attitude-card` → `quad-capacity-chip` → `quad-mode-footer`

**Freestyle:** `quad-topbar` → `quad-timer-hero` → `quad-power-strip` → `quad-gps-row` → `quad-mode-footer`

**Minimal:** `quad-topbar` → `quad-voltage-minimal` → `quad-timer-card` → `quad-link-bar` → `quad-mode-footer`

**Dense CRSF:** `quad-topbar` → `quad-metric-grid` → `quad-attitude-band` → `quad-mode-footer`

## Agent / editor guidance

- When the user asks for a whoop / freestyle / dense CRSF board, **compose from these prefab ids** instead of inventing a new grid.
- Prefer catalog sensor names above.
- Keep draw calls as direct `lcd.*` in `refresh()` for web preview.
- Insert menu → **Quad sections** when protocol is Betaflight or generic CRSF.
