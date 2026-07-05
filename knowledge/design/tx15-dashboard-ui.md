# TX15 dashboard visual design guide

Apply these rules to every generated dashboard. Goal: **clean, readable, professional** full-screen layouts — not cluttered debug screens.

**Variety:** Match layout to the user's prompt and chosen archetype (card grid, hero minimal, strip board, dense grid, heli board, etc.). Do not reuse the same two-column card template for every request unless the user asked for it.

## Design principles

1. **Less is more** — Show 4–8 key metrics max on one screen. Group the rest behind BOOL options.
2. **Clear hierarchy** — One hero metric (DBLSIZE), a few primary values (MIDSIZE), labels always SMLSIZE.
3. **Consistent grid** — Use 8px or 12px spacing. Margins: 12px from screen edges. Gaps between cards: 12px.
4. **Card layout** — Group related telemetry in bordered panels (`drawFilledRectangle` + `drawRectangle`), not loose floating text.
5. **Dark theme default** — Background `BLACK`. Cards may use `DARKGREY` but **must include accent colors** when the user asks for vibrant/colorful UI (colored borders, CYAN/LIME/MAGENTA headers, YELLOW heroes).

## Layout template (480×320 full-screen)

```
┌─────────────────────────────────────────────┐
│ HEADER (40px) — widget title, optional icon │
├──────────────────┬──────────────────────────┤
│ CARD: Link       │ CARD: Battery            │  ~120px tall
│ label + value    │ label + large voltage    │
│ progress bar     │ secondary amps           │
├──────────────────┴──────────────────────────┤
│ CARD: GPS / flight (full width)             │  ~80px
├─────────────────────────────────────────────┤
│ FOOTER (28px) — flight mode, status         │
└─────────────────────────────────────────────┘
```

- Use `LCD_W` and `LCD_H` (or `zone.w` / `zone.h`) for all sizing — never hardcode 480/320.
- Two-column cards: `colW = math.floor((w - pad * 3) / 2)` with `pad = 12`.
- **Footer-safe height:** `contentBottom = h - footerH - pad`. All body blocks must end at or above `contentBottom` (~280 on TX15). Scale row heights from `contentH = contentBottom - (headerH + pad)` instead of fixed 76/96/52 stacks. See `layout-principles.md` content budget section.

## Typography

| Role | Flag | Use for |
|------|------|---------|
| Hero | `DBLSIZE` | One main number (e.g. battery voltage, altitude) |
| Primary | `MIDSIZE` | Section values, link quality % |
| Label | `SMLSIZE` | Field names, units, footer |

- **Label → value → unit** — Use **fixed vertical strides** (no `#str * charW` suffix math — EdgeTX has no text-width API and it overlaps on radio):

| Step | Stride | Example |
|------|--------|---------|
| SMLSIZE label → MIDSIZE value | **+16px** | `yVal = yLbl + 16` |
| MIDSIZE value → SMLSIZE unit | **+16px** | `yUnit = yVal + 16` |
| unit → next section label | **+18px** | `yNextLbl = yUnit + 18` |
| DBLSIZE value → SMLSIZE unit (gauge, both CENTER) | value at `cy - 14`, unit at `cy + 10` | two lines only |

- **Same `x` for label, value, and unit** (LEFT align in cards). **CENTER** both lines in a rotary gauge.
- **Never** place unit at `valueY + 4` on the same row or use `#valueStr * charW` — causes overlap.
- **Minimum vertical spacing** — Never stack two MIDSIZE/DBLSIZE lines closer than **16px** apart (line tops).
- Avoid more than **2 DBLSIZE** strings on screen.

## Web preview compatibility

The generator web UI offers two preview modes:

| Mode | Engine | Guarantees | Default |
|------|--------|------------|---------|
| **Preview** | Regex parser (`luaPreviewEngine.ts`) | Fast; parses direct `lcd.*` in `refresh()` only | Yes |
| **Radio sim** | EdgeTX 2.11 WASM (`@edgetx/simulator-ui`) | Real Lua + firmware draw; LVGL-capable; ~5–15 MB first load | Lazy (tab) |

Both modes use the same mock telemetry catalog (`mockTelemetry.ts` → CRSF injection in Radio sim). `@simulate` zone cropping applies in Preview (overlay) and Radio sim (framebuffer crop).

To enable Radio sim locally: `npm run sync-wasm` (downloads `edgetx-tx15-simulator.wasm` to `apps/web/public/sim/`).

For **Preview** (regex) parsing rules:

1. **Cache telemetry and formatted strings as locals** before any `lcd.drawText` call.
2. In `lcd.drawText`, use **variable names or string literals only** — never `fmtNum(...)`, `telem(...)`, or `string.format(...)` inline in drawText args.
3. Good: `local vStr = string.format("%.1f", volts)` then `lcd.drawText(x, y, vStr, DBLSIZE + YELLOW)`.
4. Bad: `lcd.drawText(x, y, fmtNum(volts, 1) .. " V", DBLSIZE + YELLOW)`.

## Color semantics

| Meaning | Color |
|---------|-------|
| Good / link OK | `GREEN` |
| Battery / caution | `YELLOW` or `ORANGE` |
| Warning / low | `RED` (sparingly — one element max) |
| Labels / secondary | `GREY` or `WHITE` |
| Hero values | `WHITE`, `CYAN`, or `YELLOW` |
| Card background | `DARKGREY` on `BLACK` |
| Card border | `GREY` |

Do not use rainbow colors on every line. Pick **2 accent colors** plus grey/white.

## Progress bars

- Height 10–14px, full card width minus padding.
- Background track: `GREY`, fill: `GREEN` (link) or `YELLOW` (battery %).
- Clamp 0–100: `math.max(0, math.min(100, value))`.
- Always draw track first, then fill, then optional 1px border.

## Cards (panel pattern)

Draw directly in `refresh()` with `lcd.*` (required for web preview):

```lua
lcd.drawFilledRectangle(x, y, cw, ch, DARKGREY)
lcd.drawRectangle(x, y, cw, ch, GREY)
lcd.drawText(x + 8, y + 6, "LINK", SMLSIZE + GREY)
lcd.drawText(x + 8, y + 22, tostring(rqly) .. "%", MIDSIZE + GREEN)
```

## Anti-patterns (never do)

- Wall of same-size text with no grouping
- Values crammed at (4,4), (4,20), (4,36) with no cards or alignment
- More than 12 separate text lines without visual structure
- Random x positions — align to columns (`pad`, `pad + colW + pad`, `w/2`)
- Bright `RED`/`BLUE`/`YELLOW` on every metric
- `string.format` or concatenation inside every draw call without caching locals first
- Hiding all `lcd.*` inside nested helpers — preview cannot render them; keep draws in `refresh()`

## Options for user customization

Provide 3–5 BOOL toggles (`ShowLink`, `ShowBatt`, `ShowGPS`) plus optional `TextColor`/`BgColor` COLOR options. Do not expose every layout knob.

## Touch (TX15)

Reserve bottom 40px or use footer for status. Avoid placing critical numbers in corners where thumbs obscure them.

## Community reference — DBK / Rotorflight TX15

For **rotorflight** heli dashboards, also follow `knowledge/design/rotorflight-dbk-patterns.md` (patterns from [liuhm2019-crypto RotorflightTelemeteringScript](https://github.com/liuhm2019-crypto/RotorflightTelemeteringScript)):

- 5-block color RQLY indicator (red → green)
- Hero RPM/HSpd top area, voltage stack on the left
- Throttle bar with % label on the bar
- Footer **Current** + **Power** row (`volts * amps`)
- Show `---` / `--` when link or RPM is zero

## Quality checklist (self-review before validateWidget)

- [ ] `lcd.clear()` with dark background first
- [ ] Header or clear top section
- [ ] Metrics grouped in cards or columns
- [ ] Label/value hierarchy (SMLSIZE labels, MIDSIZE/DBLSIZE values)
- [ ] At most 2 accent colors beyond grey/white
- [ ] 12px margins, nothing clipped at edges
- [ ] All `lcd.drawText` / `lcd.drawFilledRectangle` calls directly in `refresh()`
- [ ] Zero telemetry shows `"--"` or `0` gracefully, not garbage
