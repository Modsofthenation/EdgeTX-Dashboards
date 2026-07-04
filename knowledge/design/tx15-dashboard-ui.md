# TX15 dashboard visual design guide

Apply these rules to every generated widget. Goal: **clean, readable, professional** full-screen dashboards — not cluttered debug screens.

## Design principles

1. **Less is more** — Show 4–8 key metrics max on one screen. Group the rest behind BOOL options.
2. **Clear hierarchy** — One hero metric (DBLSIZE), a few primary values (MIDSIZE), labels always SMLSIZE.
3. **Consistent grid** — Use 8px or 12px spacing. Margins: 12px from screen edges. Gaps between cards: 12px.
4. **Card layout** — Group related telemetry in bordered panels (`drawFilledRectangle` + `drawRectangle`), not loose floating text.
5. **Dark theme default** — Background `BLACK`, cards `DARKGREY` or `GREY`, borders `GREY`, text `WHITE`.

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

## Typography

| Role | Flag | Use for |
|------|------|---------|
| Hero | `DBLSIZE` | One main number (e.g. battery voltage, altitude) |
| Primary | `MIDSIZE` | Section values, link quality % |
| Label | `SMLSIZE` | Field names, units, footer |

- **Label above value** — Draw label at `y`, value at `y + 14` (not inline `"Batt 12.6V"` unless space is tight).
- **Units** — Separate from value: `"12.6"` + SMLSIZE `" V"` beside or below.
- Avoid more than **2 DBLSIZE** strings on screen.

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

## Quality checklist (self-review before validateWidget)

- [ ] `lcd.clear()` with dark background first
- [ ] Header or clear top section
- [ ] Metrics grouped in cards or columns
- [ ] Label/value hierarchy (SMLSIZE labels, MIDSIZE/DBLSIZE values)
- [ ] At most 2 accent colors beyond grey/white
- [ ] 12px margins, nothing clipped at edges
- [ ] All `lcd.drawText` / `lcd.drawFilledRectangle` calls directly in `refresh()`
- [ ] Zero telemetry shows `"--"` or `0` gracefully, not garbage
