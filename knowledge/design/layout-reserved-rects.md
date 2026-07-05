# Reserved rectangles — cross-region layout (planning aid for gauges + strips)

Use with `tx15-text-layout.md`. Recommended when the dashboard has a **circular gauge**, **satellite labels under the gauge**, and **strip/card panels** below.

Reference implementation: `examples/tx15-bfdash8f-whoop-dashboard.lua`

**Overlap enforcement:** `validateWidget` runs a **draw-call geometry check** on your final `lcd.*` calls (annulus outer disc vs foreign text, text vs text). You do **not** need custom in-script overlap loops (`anyTextForeignOverlap`, `layoutAllRects` audits, etc.). Reserved rects below are for **planning and sizing** — keep `gaugeZoneH`, `barsBlockH`, and bottom-up/top-down math so layout fits before draw.

## Algorithm (compute before any lcd.* draw)

1. **Bottom-up:** footer → GPS (if on) → strip cards (if on) → yields `stripY` / `mainBottom`
2. **Top-down:** header → arm banner → timer → link/battery bars → yields `mainTop`
3. **Main zone:** `mainH = mainBottom - mainTop` (never clamp `mainH` to a literal after `stripY` is fixed)
4. **Gauge effective height:** `gaugeZoneH(rOut) = rOut * 2 + satelliteBelowH()` where satellites are amp/`LEFT` labels at `gaugeCy + rOut + …`
5. **Fit gauge:** shrink `rOut` until `gaugeZoneH(rOut) <= mainH` and gauge rect clears strip/GPS rects
6. **Text row planning:** map each `lcd.drawText` Y to a named row height in your layout math (optional `textFootprintRects` for readability — not validated)
7. **Phase 1:** all fills, annulus, discs, card borders
8. **Phase 2:** all `lcd.drawText`

## Text-backed sizing (recommended)

When positioning text procedurally (`barsPctY = trackY + barH + LH.GAP`), derive block height from the **same expression** as the last `drawText` row:

```lua
trackY = barsY + LH.SML + LH.GAP
barsPctY = trackY + barH + LH.GAP
barsBlockH = barsPctY + barsPctRowH() - barsY  -- same chain as drawText Y
```

Do **not** maintain a separate `barsBlockH` formula that omits the `%` row. `validateWidget` enforces `barsBlockH` sync when bar `%` rows are present.

Optional text row helpers (for planning only — no overlap loop required):

```lua
local function textRowRect(x, y, w, lineH)
  return { x = x, y = y, w = w, h = lineH }
end
```

## Minimal helpers (copy pattern)

```lua
local function rect(x, y, w, h)
  return { x = x, y = y, w = w, h = h }
end

local function satelliteBelowH()
  return 6 + LH.SML + LH.GAP + LH.MID + LH.GAP + LH.SML
end

local function gaugeZoneH(rOut)
  return rOut * 2 + satelliteBelowH()
end

local function barsPctRowH()
  return LH.SML
end
```

## ShowAtt + ShowCapa

Use **separate cards** — left = attitude (PITCH + ROLL stacked when both metrics needed), right = USED mAh. Never draw ROLL and USED labels in the same card.

## Worst-case check

Re-run layout math with **every BOOL option = 1** before calling `validateWidget`.
