# EdgeTX Lua Widget Rules

These rules apply to all generated EdgeTX widget scripts in this project.

## Widget contract

Every widget MUST return a table with at minimum:
- `name` (string, max 10 characters)
- `create` (function)
- `refresh` (function)

Optional: `options`, `update`, `background`.

## Naming and deployment

- Widget `name` must be 10 characters or fewer with no spaces.
- Deploy to `WIDGETS/<name>/main.lua` on the radio SD card (folder name matches `name`).
- Do NOT use `require()` — EdgeTX widgets run in a sandbox without luarocks.

## Options

- EdgeTX 2.11+: max 10 options; EdgeTX 2.10: max 5 options.
- Each option label (first element) must be 10 characters or fewer with no spaces.
- Valid option types: SOURCE, BOOL, VALUE, COLOR, STRING.

## Layout

- Use `LCD_W` and `LCD_H` for full-screen layouts, not hardcoded pixel sizes.
- Use `zone.w` and `zone.h` when not in full-screen mode.
- Design dashboards for full-screen mode (touch events via `event` and `touchState` in `refresh`).

## Visual design (required)

Generated widgets must look **clean and professional** on a 480×320 TX15 screen.

- **Grouped regions** — Organize metrics in visual regions appropriate to the layout archetype (card panels, vertical strips, horizontal bands, or hero + corners) on a dark background.
- **12px grid** — Margins and gaps of 12px; header bar ~40px when used; footer status strip ~28px when used.
- **Content budget** — Compute `contentBottom = h - footerH - pad` before assigning block heights; scale rows to fit within `contentH` so the footer never clips the last panel.
- **Typography hierarchy** — SMLSIZE labels, MIDSIZE values, at most one DBLSIZE hero metric (required for hero-minimal).
- **Label above value** — Not a wall of inline `"Label 12.3 unit"` strings.
- **Accent colors** — Follow the creative brief palette from `knowledge/design/edgetx-theme-palettes.md`; avoid flat grey-only layouts.
- **4–8 metrics** per screen; hide extras behind BOOL options.
- **Direct `lcd.*` in `refresh()`** — Required for web preview; no opaque draw helpers.
- **Model image:** When requested, use `Bitmap.open` in `create()`, `Bitmap.getSize(bitmap)` (bitmap handle only — never the path string), `lcd.drawBitmap` in `refresh()`, plus grey placeholder panel. See `knowledge/design/model-image.md`.

See `knowledge/design/layout-principles.md` for principles and `tx15-card-grid-recipe.md` only for card-grid archetypes.

## Telemetry

- Read telemetry via `getValue("SensorName")` using discovered sensor names.
- Cache source IDs in `create()` with `getSourceIndex("SensorName")` for performance.
- **Protocol lock:** Use only sensors from the session's selected protocol catalog (`listTelemetrySensors`). UI protocol overrides firmware mentions in the user prompt — never mix betaflight and rotorflight sensor names.
- GPS returns a table; Cels returns a table of cell voltages.
- Zero is returned when telemetry is not received — handle gracefully in UI.

## Drawing

- Use `lcd.*` drawing functions only (drawText, drawRectangle, drawFilledRectangle, drawFilledCircle, drawLine, drawGauge, drawCircle, drawArc, drawAnnulus, drawBitmap, etc.).
- **`lcd.drawLine(x1, y1, x2, y2, pattern, [flags])`** — 5th arg is **`SOLID` or `DOTTED`**, not color. Put color in the 6th `flags` argument: `lcd.drawLine(x1, y1, x2, y2, SOLID, C_BORDER)`.
- **Rounded panels:** Use `drawFilledCircle` + inset `drawFilledRectangle` bars and optional `drawArc`/`drawLine` borders per `knowledge/design/rounded-card-panels.md`. Do **not** use LVGL for rounded cards unless the user explicitly opts out of web preview.
- Use EdgeTX literal colors (WHITE, CYAN, LIME, LIGHTGREY, …) or `lcd.RGB(r,g,b)` locals defined in `create()`. See `knowledge/design/edgetx-theme-palettes.md`.
- Do **not** call `lcd.setColor(COLOR_THEME_*, …)` — it changes the whole radio UI.
- **Gauges / rotary dials:** Use `lcd.drawGauge` (bar) or `lcd.drawAnnulus` / `lcd.drawArc` (rotary). Call them **directly in `refresh()`** with angle/value locals computed first — required for web preview.
- Use `SMLSIZE`, `MIDSIZE`, `DBLSIZE`, `CENTER`, `RIGHT` flags for text sizing/alignment where appropriate.

## Performance

- Keep `refresh()` lightweight — it runs every frame while visible.
- Avoid string concatenation in hot paths; pre-format where possible.
- Do not allocate large tables every refresh cycle.

## Forbidden

- No `require`, `io.*`, `os.execute`, or filesystem access.
- No `dofile`, `loadfile`, or `loadstring`.
- No network calls.
- No infinite loops or blocking operations in refresh/create.

## Validation before download

Generated widgets must pass `validateWidget` with `valid: true` before packaging:
- Return table includes `name`, `create`, `refresh`
- Widget name ≤10 characters, no spaces
- Option names ≤10 characters, no spaces
- Telemetry sensor names must exist in the selected protocol catalog
- `---@type WidgetScript` and `---@simulate` annotations (EdgeTX Dev Kit)
- `lcd.*` / `lvgl.*` calls must match EdgeTX 2.11 stubs when synced
- **`lcd.drawLine`:** 5th argument must be `SOLID` or `DOTTED`; color goes in 6th flags arg (validator rejects color-as-5th-arg — causes WASM runtime errors)
- **`Bitmap.getSize`:** pass the bitmap handle from `Bitmap.open()`, never the SD path string (validator rejects path-as-first-arg — causes `create()` crash on radio)
- **`drawArc` rounded borders:** EdgeTX `0°`=up clockwise — top-left corner uses `270, 360`, not `180, 270` (validator rejects math angles)

## Dev-kit annotations

Every widget must start with:

```lua
---@type WidgetScript
---@simulate Layout1x1 zone=0
```

- `Layout1x1` — full-screen TX15 dashboard (480×320)
- `Layout2x2 zone=N` — quarter-screen slot (N = 0..3) for multi-zone layouts

Use [EdgeTX Dev Kit](https://github.com/JeffreyChix/edgetx-dev-kit) in VS Code for WASM firmware simulation with **Simulate Script** / **Watch Script**.
