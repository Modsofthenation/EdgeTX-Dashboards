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
- Stacking text without checking total height fits the container
- Drawing dim overlays or bitmaps after text in the same region
- Hardcoded footer/header X positions that collide when strings are long

Reference: `examples/tx15-model-hero-dashboard.lua`

## Layout budget rules (mandatory for stacked panels)

### 1. Global vertical budget

Before placing a stacked block, sum every line height + gap and confirm it fits inside the container:

```lua
local CW = { SML = 6, MID = 9, DBL = 12 }

local function cardContentH(valH, gap, sec)
  local field = LH.SML + gap + valH + gap + LH.SML + sec
  return field + field - sec  -- two fields (POWER + USED)
end

local cardInnerH = cardH - cardPad * 2
if cardContentH(LH.MID, LH.GAP, LH.SEC) > cardInnerH then
  -- shrink: reduce SEC, drop MID→SML, or hide optional columns
end
```

If `allocated_height > container_height`: shrink fonts, drop lines, or grow the container — never silently overflow.

### 2. Backgrounds before text in each region

Draw order in `refresh()`:

1. All fills, bitmaps, annulus, dim overlays, opaque gauge disc
2. Progress-bar tracks
3. **All** `lcd.drawText` calls

Never interleave `drawFilledRectangle` between text calls in the same area. The gauge inner disc must be drawn before voltage text.

### 3. Horizontal row clearance

Estimate width with character count × `CW` (SML=6, MID=9, DBL=12 px/char). For left + right text on one row:

```lua
local leftEnd = leftX + estW(leftStr, "SML")
local rightStart = rightX - estW(rightStr, "SML")
if leftEnd + minGap > rightStart then
  rightStr = truncStr(rightStr, maxChars)
end
```

Footer example: chip ends at `chipX + chipW`; place `TRSS` at `chipX + chipW + gap`, not overlapping the chip edge.

### 4. Cascade dependent Y positions

Compute layout top-down from optional blocks — never hardcode downstream Y if an optional section affects it:

```lua
local barsBottom = topBarY + topBarH
local mainTop = barsBottom + pad
local mainBottom = contentBottom
if gpsH > 0 then
  mainBottom = gpsY - pad
end
local mainH = mainBottom - mainTop
```

`mainTop` must follow `barsBottom`, not a magic number.

### 5. Worst-case option check

After layout, mentally re-run with **every BOOL option = 1**. GPS strip height must be computed from its own stack (`LH.SML + gap + valH + gap + LH.SML + pad`), not a fixed 44px that truncates content.

### 6. Reserved rectangles + cross-region overlap

Every visual block gets an explicit `(x, y, w, h)` **before** drawing. Shapes with outside labels (gauge + amp/`LEFT` satellites) use **effective height** = `radius×2 + satelliteStack`, not radius alone.

```lua
local function gaugeZoneH(rOut)
  local satH = 6 + LH.SML + LH.GAP + LH.MID + LH.GAP + LH.SML
  return rOut * 2 + satH
end

-- barsBlockH must include the last text row (e.g. % readout at barsPctY)
trackY = barsY + LH.SML + LH.GAP
barsPctY = trackY + barH + LH.GAP
barsBlockH = barsPctY + LH.SML - barsY

-- mainBottom must use stripTop - pad AFTER stripH is known
-- Never clamp mainH after stripY is fixed — shrink rOut instead

-- Every drawText → textRowRect in textFootprintRects; audit via layoutAllRects
-- Final pass: anyTextForeignOverlap(textFootprintRects, layoutRects)
```

When `ShowAtt` and `ShowCapa` are both on, use **separate cards** (left = attitude, right = USED) — do not draw both ROLL and USED in the same card.

Reference: `examples/tx15-bfdash8f-whoop-dashboard.lua`, `layout-reserved-rects.md`
