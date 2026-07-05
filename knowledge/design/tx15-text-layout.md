# TX15 text layout — height-aware stacking

EdgeTX has **no text-width or text-height API**. Never guess `y + 16` between lines. Use **line-height constants** and **accumulate** `y` inside each container.

## Line heights (TX15 color LCD)

| Flag | `LH` key | Height (px) |
|------|----------|-------------|
| `SMLSIZE` | `SML` | 12 |
| `MIDSIZE` | `MID` | 18 |
| `DBLSIZE` | `DBL` | 26 |

```lua
local LH = { SML = 12, MID = 18, DBL = 26, GAP = 4, SEC = 8 }
```

- `GAP` — minimum space **between** stacked text rows (after the previous line's height).
- `SEC` — extra space **between sections** (after a unit row, before the next field label).

**Overlap rule:** gap between line tops must be ≥ previous line's height + `GAP`. Equivalently: `nextY = prevY + lineHeight(prevFont) + GAP`.

## Accumulation pattern (in `refresh()`)

Compute `y` once per container; assign each `drawText` Y from the running total. All `lcd.drawText` calls stay directly in `refresh()`.

```lua
local LH = { SML = 12, MID = 18, DBL = 26, GAP = 4, SEC = 8 }
local y = cardY + 10

local yPowerLbl = y
y = y + LH.SML + LH.GAP
local yPowerVal = y
y = y + LH.MID + LH.GAP
local yPowerUnit = y
y = y + LH.SML + LH.SEC
local yUsedLbl = y
y = y + LH.SML + LH.GAP
local yUsedVal = y
y = y + LH.MID + LH.GAP
local yUsedUnit = y

lcd.drawText(valX, yPowerLbl, "POWER", SMLSIZE + LIGHTGREY)
lcd.drawText(valX, yPowerVal, ampsStr, MIDSIZE + CYAN)
lcd.drawText(valX, yPowerUnit, "A", SMLSIZE + LIGHTGREY)
-- ...
```

## Aligned columns — one row list

When left and right columns share rows (value | attitude), **derive both from the same `y*` locals** — never hand-tune the right column separately.

```lua
lcd.drawText(valX, yPowerVal, ampsStr, MIDSIZE + CYAN)
lcd.drawText(attX, yPowerVal, rollStr, MIDSIZE + RIGHT + WHITE)
lcd.drawText(valX, yPowerUnit, "A", SMLSIZE + LIGHTGREY)
lcd.drawText(attX, yPowerUnit, "R", SMLSIZE + RIGHT + LIGHTGREY)
```

## Centered block (rotary gauge inner disc)

Center a **fixed-height text block**, not individual lines:

```lua
local blockH = LH.DBL + LH.GAP + LH.SML
local yVolt = gaugeCy - math.floor(blockH / 2)
local yVUnit = yVolt + LH.DBL + LH.GAP
lcd.drawText(gaugeCx, yVolt, voltsStr, DBLSIZE + CENTER + ORANGE)
lcd.drawText(gaugeCx, yVUnit, "V", SMLSIZE + CENTER + LIGHTGREY)
```

## Top bars, GPS strips

Same accumulation inside each panel:

```lua
local y = topBarY + 4
lcd.drawText(x, y, "LINK", SMLSIZE + LIGHTGREY)
y = y + LH.SML + LH.GAP
local trackY = y
```

## Anti-patterns

- `y + 16` / `y + 18` flat steps regardless of font size
- `#str * charW` horizontal unit placement
- `unitY = valueY + 4` on the same row as MIDSIZE/DBLSIZE
- Separate Y math for left vs right columns that should align

Reference: `examples/tx15-model-hero-dashboard.lua`
