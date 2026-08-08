# Dashboard layout principles (all archetypes)

Apply these rules to every generated dashboard. Goal: **clean, readable, professional** full-screen layouts — not cluttered debug screens.

**Variety:** Match layout to the user's prompt, creative brief, and chosen archetype. Do not reuse the same two-column card template unless the archetype is `card-grid` or `heli-rotorflight`.

## Design principles

1. **Less is more** — Show 4–8 key metrics max on one screen. Group the rest behind BOOL options.
2. **Clear hierarchy** — One hero metric (DBLSIZE), a few primary values (MIDSIZE), labels always SMLSIZE.
3. **Consistent grid** — Use 8px or 12px spacing. Margins: 12px from screen edges.
4. **Grouped regions** — Organize metrics in visual regions appropriate to the archetype (cards, strips, bands, or hero + corners) — not loose floating text walls.
5. **Dark theme default** — Background `BLACK`. Use accent colors from the creative brief palette.

## Typography

| Role    | Flag      | Use for                                                     |
| ------- | --------- | ----------------------------------------------------------- |
| Hero    | `DBLSIZE` | One main number (e.g. battery voltage, altitude, headspeed) |
| Primary | `MIDSIZE` | Section values, link quality %                              |
| Label   | `SMLSIZE` | Field names, units, footer                                  |

- **Label above value** — Draw label at `y`, value at `y + 14`.
- **Units** — Separate from value when space allows.
- Avoid more than **2 DBLSIZE** strings on screen.

## Web preview compatibility

1. **Cache telemetry and formatted strings as locals** before any `lcd.drawText` call.
2. In `lcd.drawText`, use **variable names or string literals only** — never inline `fmtNum(...)`, `telem(...)`, or `string.format(...)`.
3. Keep all `lcd.*` calls **directly in refresh()** — preview cannot render nested helpers.

## Color semantics

| Meaning            | Color                       |
| ------------------ | --------------------------- |
| Good / link OK     | `GREEN`                     |
| Battery / caution  | `YELLOW` or `ORANGE`        |
| Warning / low      | `RED` (sparingly)           |
| Labels / secondary | `GREY` or `WHITE`           |
| Hero values        | From creative brief palette |

Use the run palette accents — not rainbow on every line.

## Anti-patterns (never do)

- Wall of same-size text with no grouping
- Values crammed at (4,4), (4,20), (4,36) with no structure
- More than 12 separate text lines without visual organization
- Random x positions — align to grid
- `string.format` or concatenation inside every draw call without caching locals first
- Hiding all `lcd.*` inside nested helpers

## Options for user customization

Provide 3–5 BOOL toggles plus optional COLOR options. Do not expose every layout knob.

## Content budget (footer-safe layouts)

On a 480×320 screen with header (~40px), footer (~28px), and 12px margins, the **drawable body** is only ~228px tall. Never stack fixed-height blocks that exceed this — the footer will clip the bottom row.

Compute the safe area first, then scale row heights:

```lua
local pad = 12
local headerH = 40
local footerH = 28
local contentTop = headerH + pad
local contentBottom = h - footerH - pad   -- gap above footer
local contentH = contentBottom - contentTop

-- Example: 3 stacked rows with 2 gaps between them
local blockH = contentH - 2 * pad
local ratioSum = 76 + 96 + 52            -- desired proportions
local gpsH = math.floor(blockH * 76 / ratioSum)
local midH = math.floor(blockH * 96 / ratioSum)
local motorH = blockH - gpsH - midH      -- remainder avoids rounding overflow

local gpsY = contentTop
local midY = gpsY + gpsH + pad
local motorY = midY + midH + pad
-- motorY + motorH must be <= contentBottom
```

When BOOL options hide a row, **reclaim its height** — do not leave empty reserved space and do not keep using the full 3-row stack.

## Touch (TX15)

Reserve bottom 40px or use footer for status. Avoid placing critical numbers where thumbs obscure them.

## Quality checklist (self-review before validateWidget)

- [ ] `lcd.clear()` with dark background first
- [ ] Clear visual hierarchy (SMLSIZE labels, MIDSIZE/DBLSIZE values)
- [ ] Grouped regions match the archetype
- [ ] 12px margins, nothing clipped at edges
- [ ] All `lcd.drawText` / `lcd.drawFilledRectangle` calls directly in `refresh()`
- [ ] Zero telemetry shows `"--"` or `0` gracefully
