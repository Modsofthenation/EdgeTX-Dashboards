# EdgeTX theme colors and dashboard palettes

Use these palettes so dashboards look polished on TX15 color LCDs and preview correctly in the web UI.

## EdgeTX color constants (use in `lcd.*` flags)

**Literal colors** (safe everywhere; preview supports all listed):

| Constant | Typical use |
|----------|-------------|
| `BLACK`, `WHITE`, `LIGHTGREY`, `GREY`, `DARKGREY` | Backgrounds, cards, labels |
| `CYAN`, `LIME`, `YELLOW`, `ORANGE`, `MAGENTA` | Accents, heroes, borders |
| `GREEN`, `BRIGHTGREEN`, `RED`, `DARKRED`, `BLUE`, `DARKBLUE` | Status, warnings, links |

**Theme colors** (match radio UI; preview approximates these):

| Constant | Role |
|----------|------|
| `COLOR_THEME_PRIMARY1` | Deep accent / shadow |
| `COLOR_THEME_PRIMARY2` | Main background panels |
| `COLOR_THEME_PRIMARY3` | Dividers, subtle lines |
| `COLOR_THEME_SECONDARY1` | Primary text |
| `COLOR_THEME_SECONDARY2` | Secondary text / muted labels |
| `COLOR_THEME_SECONDARY3` | Input / bar backgrounds |
| `COLOR_THEME_FOCUS` | Highlight strip, selection |
| `COLOR_THEME_ACTIVE` | Active state |
| `COLOR_THEME_WARNING` | Caution / alarm |
| `COLOR_THEME_DISABLED` | Disabled / placeholder |
| `CUSTOM_COLOR` | Re-assign once in `create()` via `lcd.RGB()` if needed |

Do **not** call `lcd.setColor(COLOR_THEME_*, …)` — it changes the entire radio UI. Prefer literal colors or `lcd.RGB()` locals.

## Custom RGB (recommended for branded dashboards)

Define in `create()` and reuse in `refresh()`:

```lua
local C_BG     = lcd.RGB(18, 22, 32)
local C_CARD   = lcd.RGB(32, 38, 52)
local C_ACCENT = lcd.RGB(0, 200, 255)
local C_HERO   = lcd.RGB(255, 220, 80)
local C_LABEL  = lcd.RGB(160, 168, 184)
```

Preview parses `local Name = lcd.RGB(r, g, b)` and resolves draws that use `Name` in flags.

## Curated dashboard palettes (pick one per run / creative brief)

### 1. Edge Dark Cyan (default pro look)
- Background: `BLACK` or `lcd.RGB(14, 16, 22)`
- Cards: `DARKGREY` / `lcd.RGB(36, 40, 52)` + `CYAN` border
- Hero: `CYAN` or `WHITE`
- Labels: `GREY`
- Status OK: `GREEN` · Warning: `ORANGE` · Alarm: `RED`

### 2. Edge Dark Lime (FPV / energetic)
- Background: `BLACK`
- Cards: `DARKGREY` + `LIME` 2px top stripe
- Hero: `LIME`
- Secondary: `YELLOW`
- Link bars: `LIME` fill on `GREY` track

### 3. Warm Cockpit (battery-centric)
- Background: `lcd.RGB(20, 14, 10)`
- Cards: `lcd.RGB(40, 28, 20)` + `ORANGE` border
- Hero: `YELLOW`
- Labels: `LIGHTGREY`
- Footer: `ORANGE` on `DARKGREY`

### 4. Rotor Neon (rotorflight / heli)
- Background: `BLACK`
- Cards: `lcd.RGB(28, 20, 40)` + `MAGENTA` border
- Headspeed hero: `MAGENTA` or `CYAN`
- Temps: `ORANGE` / `YELLOW`
- Link: `GREEN` blocks

### 5. Light Surface (user asks for white / light background)
- Background: `LIGHTGREY` or `lcd.RGB(220, 224, 232)`
- Cards: `WHITE` fill + `GREY` border
- Text on light panels: `BLACK` (never white-on-white)
- Accents: `DARKBLUE`, `DARKGREEN`, `DARKRED`
- Footer: `GREY` bar, `BLACK` labels

### 6. Stealth Grey (minimal)
- Background: `BLACK`
- Structure: `GREY` / `DARKGREY` only
- Single accent: `GREEN` or `CYAN` on one hero metric
- No rainbow — one highlight only

## Rotary gauges and custom widgets (preview-compatible)

EdgeTX has no separate “widget library” — build gauges with `lcd.drawGauge`, `lcd.drawArc`, and `lcd.drawAnnulus` **called directly in `refresh()`** so the web preview renders them.

### Vertical bar gauge (`drawGauge`)
```lua
local pct = math.max(0, math.min(100, rqly))
lcd.drawGauge(x, y, w, h, pct, 100, 0)
lcd.drawRectangle(x, y, w, h, CYAN)
```

### Rotary / arc gauge (`drawAnnulus`) — headspeed, battery %, RPM

**Angles:** `0°` = up, clockwise (`90°` = right) — same as `drawArc`, not math convention.

```lua
-- Compute angles as locals BEFORE draw calls
local cx, cy = 120, 140
local rOut, rIn = 44, 34
local startA = 135
local span = 270
local trackEndA = startA + span
local valA = startA + span * (pct / 100)

local rIn, rOut = 42, 56
local startA = 135
local span = 270
local trackEndA = startA + span
local valA = startA + span * (pct / 100)

if trackEndA > 360 then
  lcd.drawAnnulus(cx, cy, rIn, rOut, startA, 360, GREY)
  lcd.drawAnnulus(cx, cy, rIn, rOut, 0, trackEndA - 360, GREY)
else
  lcd.drawAnnulus(cx, cy, rIn, rOut, startA, trackEndA, GREY)
end
-- Apply the same split when valA > 360 for the fill color
lcd.drawText(cx, cy - 6, pctStr, MIDSIZE + CENTER + WHITE)
```

### Simple dial tick (`drawArc`)
```lua
lcd.drawArc(cx, cy, 40, 210, 330, GREY)
lcd.drawArc(cx, cy, 40, 210, valAngle, CYAN)
```

### Rules for preview
1. All `lcd.drawGauge` / `lcd.drawArc` / `lcd.drawAnnulus` / `lcd.drawCircle` must be **directly in `refresh()`** (not inside helper functions the parser cannot see).
2. Pass **numeric literals or local variables** for coordinates and angles — not inline `math.*` in the draw call args when avoidable (assign to locals first).
3. Pair rotary gauges with a centered `lcd.drawText` value label.
4. Prefer one rotary hero + rectangular cards for secondary metrics — not every metric in a dial.

## Visual quality checklist
- [ ] Background + card colors from one palette (not random per element)
- [ ] 2–3 accent colors max besides grey/white/black
- [ ] Light background → dark text on panels
- [ ] At least one visual “anchor” (rotary hero, accent header stripe, or colored border system)
- [ ] Gauges have track + fill + numeric label
