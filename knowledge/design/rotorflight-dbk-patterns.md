# Rotorflight / TX15 heli dashboard patterns (DBK reference)

Style and logic notes distilled from community TX15 Rotorflight dashboards (notably [liuhm2019-crypto/RotorflightTelemeteringScript](https://github.com/liuhm2019-crypto/RotorflightTelemeteringScript) — `DBK_Dashboard`). Use these as **guidelines** for heli/rotorflight widgets; keep generated code simpler unless the user asks for logging, bitmaps, or flight history.

## Layout philosophy (DBK-style)

1. **Hero metric top-right** — Headspeed or RPM as `DBLSIZE` (optionally `BOLD`), label in `SMLSIZE` beside/below (e.g. `"Rpm"`).
2. **Left column stack** — Voltage, cell voltage, BEC in labeled rows (`SMLSIZE` label + `MIDSIZE` value).
3. **Center visual** — Battery fuel ring (`lcd.drawAnnulus`) or large % readout when `Bat%` + `Capa` available.
4. **Right column** — Flight timer `MM:SS`, optional flight-count badge.
5. **Bottom band** — Throttle bar (full width, ~20px tall) with color gradient fill; below that **Current** + **Power** on one row (`BOLD` labels).
6. **Top strip** — Multi-block **link quality** indicator (5 squares) + numeric RQLY/RSSI.

Use a **1px horizontal rule** (`lcd.drawFilledRectangle(x, y, w, 1, GREY)`) between major zones when not using full card borders.

## Telemetry handling

```lua
-- Prefer availability flags when resolving sensors (DBK pattern)
local field_id = {}
for i, name in ipairs({ "RxBt", "Curr", "HSpd", "Bat%", "RQLY", "1RSS" }) do
  local info = getFieldInfo(name)
  field_id[name] = info and info.id or 0
end

local function readSensor(name)
  local id = field_id[name]
  if id and id > 0 then return getValue(id) end
  return 0
end
```

For widgets using `getSourceIndex` in `create()` (our default), keep that pattern but **mirror DBK zero-handling**:

- Link lost / zero: show `"---"` in `MIDSIZE + RED`, not `0%`.
- RPM/HSpd zero: show `"--"` not `0`.
- Voltage: `string.format("%.2f", v)` then append `"v"` in a **separate** drawText or cached `volt_str = string.format("%.2fv", v)`.
- Temperature zero: show `"--"`; when > 0 use `string.format("%d", math.floor(t + 0.5)) .. "C"`.

**Always cache formatted strings as locals** before `lcd.drawText` (required for web preview).

## Link quality — 5-block RQLY bar

Unroll in `refresh()` (preview parses direct `lcd.*` calls only):

```lua
local rqly = telem(widget.src.rqly)  -- or readSensor("RQLY")
local active = math.floor((math.max(0, math.min(100, rqly)) + 19) / 20)
-- blocks at x, x+7, x+14, x+21, x+28 — height 5, width 5
-- colors by block index when i <= active: RED, ORANGE, YELLOW, LIME-ish, GREEN
-- inactive blocks: GREY
```

Optional numeric readout beside bars: `string.format("%d%%", math.floor(rqly + 0.5))`.

## Battery presentation

- **Card layout** (our default): large `DBLSIZE` voltage, `Bat%` as `MIDSIZE`, `Curr` as secondary line.
- **DBK annulus** (optional, color LCD): `lcd.drawAnnulus` for % ring — green→red via `lcd.RGB(255-pct*2.55, pct*2.55, 0)`; only if user wants a “fuel gauge” look.
- Show `Capa` as `"%dmAh"` under the ring or in card footer when sensor exists.

## Throttle bar

```lua
local thr = math.max(0, math.min(100, throttle_pct))
local barW, barH = 150, 20
local fillW = math.floor(barW * thr / 100)
lcd.drawFilledRectangle(x, y, barW, barH, GREY)          -- track
if fillW > 4 then
  lcd.drawFilledRectangle(x + 2, y + 2, fillW - 4, barH - 4, GREEN)  -- or RGB gradient
end
local thrStr = string.format("%d%%", math.floor(thr + 0.5))
lcd.drawText(x + barW / 2, y + barH / 2, thrStr, SMLSIZE + WHITE)  -- centered label on bar
```

## Current & power row (TX15 footer)

```lua
local volts = telem(widget.src.rxbt)
local amps = telem(widget.src.curr)
local curStr = amps > 0 and string.format("%.1fA", amps) or "0.0A"
local power = volts * amps
local pwrStr = "0.0W"
if power > 0 then
  pwrStr = power >= 1000 and string.format("%.1fkW", power / 1000) or string.format("%.0fW", power)
end
lcd.drawText(x1, y, "Current", BOLD + SMLSIZE + GREY)
lcd.drawText(x2, y, curStr, BOLD + SMLSIZE + GREEN)
lcd.drawText(x3, y, "Power", BOLD + SMLSIZE + GREY)
lcd.drawText(x4, y, pwrStr, BOLD + SMLSIZE + GREEN)
```

## Flight timer display

Show `MM:SS` for session timer in a dedicated slot (MIDSIZE). If no timer source, omit or show `00:00` greyed out. DBK ties timer to throttle/arm switches — **only add arm/throttle timer logic if the user requests it**.

## Widget options (DBK-inspired)

For rotorflight dashboards, offer:

| Option       | Type  | Purpose                 |
| ------------ | ----- | ----------------------- |
| `ShowLink`   | BOOL  | Link card + RQLY blocks |
| `ShowBatt`   | BOOL  | Battery card / annulus  |
| `ShowHead`   | BOOL  | Headspeed hero          |
| `ShowMotor`  | BOOL  | RPM, ESC/MOT temps      |
| `ValueColor` | COLOR | Primary value accent    |
| `TextColor`  | COLOR | Labels / header         |

Avoid exposing more than 6–7 options unless requested.

## TX15 / radio offsets

DBK checks `getVersion()` for `"tx15"` and applies a small vertical offset (`radioH = 30`) for bitmap placement. For generated widgets **without bitmaps**, use the standard 12px grid from `tx15-dashboard-ui.md` — no extra offset unless using `lcd.drawBitmap`.

## What NOT to copy into default generations

- SD card flight logging (`io.open`, log files) — only on request
- `lcd.drawBitmap` / model photo paths — only on request
- Audio `playTone` alerts — only on request
- Complex rounded rects via `lcd.drawArc` — optional polish, not required
- Nested helper functions that hide `lcd.*` — **always keep drawable calls in `refresh()`**

## Quality bar for rotorflight

- [ ] Hero headspeed or RPM visible at a glance
- [ ] Link quality uses color blocks or bar, not just a number
- [ ] Zero/missing telemetry shows `--` / `---`, never garbage
- [ ] Current + power computed when `RxBt` and `Curr` available
- [ ] Motor temps (EscT, MotT) in motor row with `C` suffix
- [ ] Footer shows flight mode (`FM`) when string, else `"Ready"`
