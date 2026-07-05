# EdgeTX runtime API pitfalls (validator + WASM enforced)

These mistakes often **pass casual review** but **crash on the radio** or in the WASM preview. `validateWidget` rejects them as errors — fix before packaging.

## lcd.drawLine — pattern vs color

**Signature:** `lcd.drawLine(x1, y1, x2, y2, pattern, [flags])`

- 5th argument: **`SOLID` or `DOTTED`** (line pattern)
- 6th argument: color flags (`CYAN`, `widget.C_BORDER`, `SMLSIZE + WHITE`, …)

```lua
-- WRONG — WASM/runtime error (nil or type error on arg 5)
lcd.drawLine(x1, y1, x2, y2, widget.C_BORDER)

-- RIGHT
lcd.drawLine(x1, y1, x2, y2, SOLID, widget.C_BORDER)
```

## Bitmap.getSize — handle only, never the path

**Signature:** `Bitmap.getSize(bitmap)` — one argument: the object from `Bitmap.open()`.

The SD path string is only for `Bitmap.open()`. Do **not** pass the path to `getSize`.

```lua
-- WRONG — create() crashes: BITMAP* expected, got string
local modelBmp = Bitmap.open(MODEL_IMG)
local w, h = Bitmap.getSize(MODEL_IMG, modelBmp)
local w, h = getSize(MODEL_IMG)

-- RIGHT
local modelBmp = Bitmap.open(MODEL_IMG)
local w, h = Bitmap.getSize(modelBmp)
-- or: local w, h = modelBmp:getSize()
```

Load bitmaps **once in `create()`**, store on the widget table, draw with `lcd.drawBitmap(widget.modelBmp, …)` in `refresh()`.

## Bitmap.open placement

- Call `Bitmap.open(path)` in **`create()`** only — not every `refresh()` frame.
- If the file is missing, the bitmap width/height are 0 — draw a grey placeholder panel instead of calling `getSize` on the path.

## lcd.drawArc — EdgeTX angle convention (rounded borders)

**Angles:** `0°` = up, `90°` = right, `180°` = down, `270°` = left (clockwise). This is **not** the math convention (`0°` = right).

```lua
-- WRONG at top-left corner — hooks/gaps on radio (math angles)
lcd.drawArc(x + cr, y + cr, cr, 180, 270, C_BORDER)

-- RIGHT top-left quarter arc
lcd.drawArc(x + cr, y + cr, cr, 270, 360, C_BORDER)
```

See `knowledge/design/rounded-card-panels.md` for all four corners. Prefer fill-only rounded panels (six `drawFilled*` calls, no `drawArc`) if you skip borders.

## lcd.drawFilledRectangle — opacity is 0–15

Optional 6th argument sets **blend opacity** on color LCDs: **0 = transparent, 15 = opaque**. It is **not** 0–255.

```lua
-- WRONG — undefined behavior; can wash out or hide layers
lcd.drawFilledRectangle(0, bodyY, w, bodyH, BLACK, 168)

-- RIGHT — subtle dim over model background
local BG_DIM = 10
lcd.drawFilledRectangle(0, bodyY, w, bodyH, BLACK, BG_DIM)
```

## Unit labels — fixed row strides (no suffix math)

EdgeTX has **no text-width API**. Do **not** position units with `#str * charW` or on the same row as `valueY + 4` — values overlap on radio.

```lua
-- WRONG — overlaps digits
lcd.drawText(x, y, ampsStr, MIDSIZE + CYAN)
lcd.drawText(x + math.floor(#ampsStr * 9) + 4, y + 4, "A", SMLSIZE + LIGHTGREY)

-- RIGHT — label, value, unit on separate rows (+16 / +16 / +18 strides)
local y0 = cardY + 10
lcd.drawText(x, y0, "POWER", SMLSIZE + LIGHTGREY)
lcd.drawText(x, y0 + 16, ampsStr, MIDSIZE + CYAN)
lcd.drawText(x, y0 + 32, "A", SMLSIZE + LIGHTGREY)

-- Gauge: two CENTER lines only
lcd.drawText(cx, cy - 14, voltsStr, DBLSIZE + CENTER + ORANGE)
lcd.drawText(cx, cy + 10, "V", SMLSIZE + CENTER + LIGHTGREY)
```

See `tx15-dashboard-ui.md` stride table and `model-hero-dashboard.md`.

## math.deg — not available on EdgeTX Lua

```lua
-- WRONG — nil or runtime error on radio
local rollDeg = math.deg(roll)

-- RIGHT — CRSF attitude is usually already degrees
local rollDeg = math.floor(roll + 0.5)
-- If values look like radians (|v| <= 2), use: math.floor(roll * 57.3 + 0.5)
```

## lcd.drawAnnulus — inner radius first

**Signature:** `lcd.drawAnnulus(x, y, r1, r2, start, end [, flags])` where **`r1` = inner (smaller)** and **`r2` = outer (larger)**.

```lua
-- WRONG — ring invisible; only a filled backdrop circle shows
lcd.drawAnnulus(cx, cy, rOut, rIn, 135, 405, GREY)

-- RIGHT
lcd.drawAnnulus(cx, cy, rIn, rOut, 135, 405, GREY)
```

## lcd.drawAnnulus — angles > 360°

Same angle convention as `drawArc` (`0°` = up, clockwise). A 270° arc from `startA = 135` ends at `405°`. Some radios skip arcs when `endAngle > 360` — **split** into two calls (`startA`→`360`, then `0`→remainder). See `model-hero-dashboard.md`.

## When adding model / background images

See `knowledge/design/model-image.md` for layout and `ShowModel` option. Always follow the `Bitmap.open` + `Bitmap.getSize(bitmap)` pattern above.
