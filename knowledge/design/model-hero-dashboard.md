# Model-background + hero gauge dashboards

Use when the user wants a **model photo behind the UI**, a **rotary battery gauge**, or a **tinywhoop / quad overview** with visual flair.

Reference implementation: `examples/tx15-model-hero-dashboard.lua`

## Layer order (mandatory)

Draw in this order so elements are not hidden:

1. `lcd.clear(BLACK)`
2. **Model bitmap** — full body region only (`bodyY` … `bodyY + bodyH`), not under header/footer
3. **Dim overlay** — `lcd.drawFilledRectangle(0, bodyY, w, bodyH, BLACK, BG_DIM)` with `BG_DIM` **0–15** (see pitfalls)
4. **Opaque chrome** — header + footer bars (solid `C_CARD`, no transparency)
5. **Top metric strips** — link/battery bars (fill-only rounded panels; skip `drawArc` borders on strips &lt; 36px tall)
6. **Hero zone** — gauge backdrop disc, annulus track + fill, centered voltage/mAh text
7. **Side card** — power/attitude panel (rounded fill + optional border arcs)
8. **Footer labels** — armed chip, TRSS, flight mode (one place only — do not duplicate FM mid-screen)

## Full-screen model image

Load in `create()`; draw in `refresh()` with **cover** scaling so the photo fills the body (not a narrow pillar):

```lua
local scaleX = math.floor(bodyW * 100 / widget.bmpW)
local scaleY = math.floor(bodyH * 100 / widget.bmpH)
local bmpScale = scaleX
if scaleY > bmpScale then bmpScale = scaleY end  -- cover (use max, not min)
local drawW = math.floor(widget.bmpW * bmpScale / 100)
local drawH = math.floor(widget.bmpH * bmpScale / 100)
local imgX = math.floor((w - drawW) / 2)
local imgY = math.floor(bodyY + (bodyH - drawH) / 2)
lcd.drawBitmap(widget.modelBmp, imgX, imgY, bmpScale)
```

If `bmpW` or `bmpH` is 0 (missing PNG on SD), skip bitmap and optionally draw a subtle `DARKGREY` panel — do not leave a random vertical bar.

Dim overlay: `local BG_DIM = 10` in `create()`, reuse in `refresh()`.

## Rotary battery gauge (`drawAnnulus`)

**Radius order (critical):** `lcd.drawAnnulus(x, y, r1, r2, start, end, color)` — **`r1` = inner (smaller), `r2` = outer (larger)**. EdgeTX C++ uses `internalRadius, externalRadius`. Passing `rOut, rIn` draws nothing; you only see a `drawFilledCircle` backdrop.

```lua
local rIn = 42
local rOut = 56
-- WRONG — ring invisible on radio
lcd.drawAnnulus(cx, cy, rOut, rIn, startA, endA, GREY)
-- RIGHT
lcd.drawAnnulus(cx, cy, rIn, rOut, startA, endA, GREY)
```

**Angles:** `0°` = up, clockwise (`90°` = right, `180°` = down).

- Default arc: **270° sweep** opening at the bottom — `startA = 135`, full track ends at `startA + 270` (405° ≡ 45°).
- On some radios, `endAngle > 360` does not render — **split the track** (all `lcd.drawAnnulus` calls must be **directly in `refresh()`**, not inside helpers — web preview requirement):

```lua
local startA = 135
local span = 270
local trackEndA = startA + span
local valA = startA + span * (batPct / 100)

lcd.drawFilledCircle(cx, cy, rOut + 2, DARKGREY)
if trackEndA > 360 then
  lcd.drawAnnulus(cx, cy, rIn, rOut, startA, 360, GREY)
  lcd.drawAnnulus(cx, cy, rIn, rOut, 0, trackEndA - 360, GREY)
else
  lcd.drawAnnulus(cx, cy, rIn, rOut, startA, trackEndA, GREY)
end
if batPct > 0 then
  if valA > 360 then
    lcd.drawAnnulus(cx, cy, rIn, rOut, startA, 360, ORANGE)
    lcd.drawAnnulus(cx, cy, rIn, rOut, 0, valA - 360, ORANGE)
  else
    lcd.drawAnnulus(cx, cy, rIn, rOut, startA, valA, ORANGE)
  end
end
```

Do **not** paint a solid `drawFilledCircle` at `rOut` behind the ring — it hides the gauge when annulus fails. Use a small inner disc only (`rIn - 4`, `BLACK`) **after** the annulus for text contrast.

**Side card borders:** skip `drawLine`/`drawArc` on rounded cards over busy backgrounds — corner hooks are visible. Prefer fill-only panel + **2px top accent stripe** (`lcd.drawFilledRectangle(cardX, cardY, cardW, 2, MAGENTA)`).

Center the gauge in the **left column** (~50–52% of width); place the power/attitude card in the right column with `cardX = heroW + pad`.

**Inside the ring:** two CENTER lines from a centered block — see `tx15-text-layout.md`:

```lua
local gaugeBlockH = LH.DBL + LH.GAP + LH.SML
local yVolt = gaugeCy - math.floor(gaugeBlockH / 2)
local yVUnit = yVolt + LH.DBL + LH.GAP
lcd.drawText(gaugeCx, yVolt, voltsStr, DBLSIZE + CENTER + ORANGE)
lcd.drawText(gaugeCx, yVUnit, "V", SMLSIZE + CENTER + LIGHTGREY)
```

**Card metrics:** accumulate `y` with `LH.SML` / `LH.MID` / `LH.GAP` / `LH.SEC`; share `yPowerVal`, `yPowerUnit`, `yUsedVal`, `yUsedUnit` with the attitude column.

## Layout proportions (TX15 480×320)

| Region | Size |
|--------|------|
| Header | 40px, accent stripe 2px |
| Footer | 28px, accent stripe 2px |
| Pad | 12px grid |
| Top bars | 30px tall, two equal columns |
| Hero column | ~248px wide (gauge centered at `heroW / 2`) |
| Side card | remaining width minus pad |

## Rounded panels

- **Large card** (`cr = 8`): six fill calls + optional `drawArc` border (correct EdgeTX angles — see `rounded-card-panels.md`).
- **Small top bars** (`cr = 6`): **fill only** — borders on 30px strips cause visible corner hooks; skip `drawLine`/`drawArc` there.

## Attitude readouts

EdgeTX Lua has **no `math.deg`**. Betaflight CRSF `Ptch` / `Roll` are usually already in degrees — use `math.floor(roll + 0.5)`. If values look like radians (|v| ≤ 2), multiply by `57.3` first.

## Anti-patterns

- `lcd.drawFilledRectangle(..., BLACK, 168)` — opacity is **0–15**, not 0–255
- `math.deg(...)` — crashes or nil on radio
- Duplicate flight-mode text (mid-page bar **and** footer)
- `Bitmap.getSize(MODEL_IMG)` — path string instead of handle
- Contain-scale (`min(scaleX, scaleY)`) for full-screen backgrounds — leaves empty pillars
- `drawArc` borders on every tiny strip
- `#str * charW` unit positioning or `unitY = valueY + 4` inline units — use fixed row strides instead
