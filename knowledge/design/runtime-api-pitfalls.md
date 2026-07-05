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

## When adding model / background images

See `knowledge/design/model-image.md` for layout and `ShowModel` option. Always follow the `Bitmap.open` + `Bitmap.getSize(bitmap)` pattern above.
