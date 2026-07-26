# Live telemetry (Web Serial) vs radio sensors

## What “Live radio” does today

The desktop/browser **Live radio** control opens a **Web Serial** port and parses
**standard CRSF frames** (link, battery, attitude, GPS, vario, flight mode).

Those frames map to common catalog keys (`RxBt`, `Curr`, `RQLY`, `FM`, …).

## Rotorflight custom sensors (rf2bg)

Sensors such as `HSpd`, `Gov`, `Vbec`, `Vcel`, `EscT` are published by **rf2bg**
on the **radio’s EdgeTX telemetry table**. They are **not** standard CRSF frame
types on a USB serial wire from the radio.

| Path                                                | What you get                                                                 |
| --------------------------------------------------- | ---------------------------------------------------------------------------- |
| Web Serial CRSF                                     | True live values for standard CRSF keys                                      |
| Preview **enrich** (default on for Rotorflight)     | Synthetic fill for missing HSpd/Gov/Vbec/… so StacyDash boards stay readable |
| **Sensor dump** companion (`tools/sensor_dump.lua`) | On-radio list of discovered `getValue` keys (true RF table)                  |
| Radio + rf2bg + Discover new                        | True FC sensors **on the radio**; bind them in Layout / Generate             |

### Enrich vs live toggle

In Layout and Generate preview:

- **Enrich on** — missing RF keys are filled for preview (not FC truth).
- **Enrich off** — only keys present on the CRSF stream (and any that appear
  under “Seen on live radio” in Properties).

### Path to true RF values in the app

Until EdgeTX exposes a USB dump of the full sensor table, use this workflow:

1. Special Function → **rf2bg** (Repeat On) on the radio
2. Telemetry → Discover new
3. Install the **RF sensor dump** companion (Layout Insert → StacyDash electric pack, or sensor-dump suite) and run it under SYS → Tools to confirm `HSpd`/`Gov`/`Vbec`
4. Bind those keys on value tiles in Layout (Live radio “Seen on live radio” for CRSF keys; catalog / paste dump names for RF customs)
5. Use Live radio + **Enrich off** in the app for standard CRSF only

## Related

- `apps/web/src/lib/liveTelemetryBridge.ts`
- `apps/web/src/lib/companionSuites.ts` (`sensor-dump`, `stacy-electric`)
- `knowledge/design/stacydash-rotorflight-sections.md`
