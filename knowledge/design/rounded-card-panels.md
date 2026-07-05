# Rounded card panels (lcd API — web preview compatible)

Use when the user asks for **rounded corners**, **soft corners**, or **rounded cards/blocks**.

**Do not** switch to LVGL (`useLvgl`, `lvgl.rectangle`) — the generator web preview only parses **`lcd.*` calls directly in `refresh()`**.

## Corner radius

- Default **`cr = 8`** on TX15 (480×320). Use **`cr = 6`** for small strips; **`cr = 10`** for large hero bands.
- Require **`w >= 2 * cr + 4`** and **`h >= 2 * cr + 4`** or fall back to square `drawFilledRectangle`.

## Filled rounded panel (6 lcd calls)

Given panel origin `(x, y)`, size `(w, h)`, fill color `C_CARD`, radius `cr`:

```lua
lcd.drawFilledRectangle(x, y + cr, w, h - 2 * cr, C_CARD)
lcd.drawFilledRectangle(x + cr, y, w - 2 * cr, h, C_CARD)
lcd.drawFilledCircle(x + cr, y + cr, cr, C_CARD)
lcd.drawFilledCircle(x + w - cr, y + cr, cr, C_CARD)
lcd.drawFilledCircle(x + cr, y + h - cr, cr, C_CARD)
lcd.drawFilledCircle(x + w - cr, y + h - cr, cr, C_CARD)
```

Draw **fill before border and text**. Cache `cr` as a local in `refresh()` (or store on widget in `create()`).

## Rounded border (optional, after fill)

Outline color `C_BORDER`, same `cr`:

```lua
lcd.drawLine(x + cr, y, x + w - cr, y, SOLID, C_BORDER)
lcd.drawLine(x + cr, y + h - 1, x + w - cr, y + h - 1, SOLID, C_BORDER)
lcd.drawLine(x, y + cr, x, y + h - cr, SOLID, C_BORDER)
lcd.drawLine(x + w - 1, y + cr, x + w - 1, y + h - cr, SOLID, C_BORDER)
lcd.drawArc(x + cr, y + cr, cr, 180, 270, C_BORDER)
lcd.drawArc(x + w - cr, y + cr, cr, 270, 360, C_BORDER)
lcd.drawArc(x + cr, y + h - cr, cr, 90, 180, C_BORDER)
lcd.drawArc(x + w - cr, y + h - cr, cr, 0, 90, C_BORDER)
```

## Grid / strip boards

Apply the same pattern to **every** card/strip in the grid — header and footer bars may stay square or use a smaller `cr` (4–6).

## Preview requirement

Emit all **`lcd.drawFilledRectangle`**, **`lcd.drawFilledCircle`**, **`lcd.drawLine`**, and **`lcd.drawArc`** calls **inline in `refresh()`** — do not hide them inside nested helper functions.

## Anti-patterns

- Do not use `lvgl.rectangle({ rounded = … })` unless the user explicitly accepts no web preview.
- Do not use square `drawRectangle` on top of rounded fills (square outline defeats rounded corners).
- Do not draw corner circles with radius larger than half the panel width/height.
