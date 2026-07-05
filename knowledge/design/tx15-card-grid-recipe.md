# TX15 card-grid layout recipe

Use this wireframe **only** when the archetype is `card-grid` or `heli-rotorflight`. Other archetypes must not copy this template.

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

- Use `LCD_W` and `LCD_H` — never hardcode 480/320.
- Two-column cards: `colW = math.floor((w - pad * 3) / 2)` with `pad = 12`.
- **Vary** which metrics occupy each card based on user prompt and creative brief — do not always use LINK left / BATTERY right.

## Progress bars

- Height 10–14px, full region width minus padding.
- Background track: `GREY`, fill: `GREEN` (link) or `YELLOW` (battery %).

## Card panel pattern

Square corners (default):

```lua
lcd.drawFilledRectangle(x, y, cw, ch, DARKGREY)
lcd.drawRectangle(x, y, cw, ch, GREY)
lcd.drawText(x + 8, y + 6, "LINK", SMLSIZE + GREY)
lcd.drawText(x + 8, y + 22, rqlyStr, MIDSIZE + GREEN)
```

When the user asks for **rounded corners**, use the lcd pattern in `knowledge/design/rounded-card-panels.md` instead of square `drawRectangle` outlines.

Use accent colors from the creative brief for borders and heroes — not plain GREY on every run.
