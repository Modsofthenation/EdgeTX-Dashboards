# Model image in dashboards

When the user asks for a **model photo**, **plane/heli image**, or **model picture** on the dashboard, include an optional model-image region.

## SD card path

EdgeTX model images live on the radio SD card:

- `/MODELS/<modelname>.png` — model image selected in Model Setup
- Use `Bitmap.open("/MODELS/model.png")` as a documented default; mention in INSTALL.md that users should copy their model PNG or match the filename to their model.

## Widget pattern (required for web preview)

Load once in `create()`, draw in `refresh()` with a **placeholder fallback** when width/height are 0.

**Common crash:** passing the SD path to `Bitmap.getSize` — use the bitmap handle only (see `runtime-api-pitfalls.md`).

```lua
local MODEL_IMG = "/MODELS/model.png"

local function create(zone, opts)
  local modelBmp = Bitmap.open(MODEL_IMG)
  local bmpW, bmpH = Bitmap.getSize(modelBmp)  -- bitmap handle only, never the path string

  return {
    zone = zone,
    options = opts,
    modelBmp = modelBmp,
    bmpW = bmpW,
    bmpH = bmpH,
    src = { ... },
  }
end

-- Inside refresh(), when ShowModel option enabled:
local imgW = 72
local imgH = 56
local imgX = leftX + 8
local imgY = cardY + 8

if widget.options.ShowModel == 1 then
  lcd.drawBitmap(widget.modelBmp, imgX, imgY)
  -- Fallback when bitmap missing (width 0 on radio; preview draws MODEL placeholder for drawBitmap)
  -- Also draw placeholder panel if you need guaranteed border on radio:
  -- lcd.drawFilledRectangle + lcd.drawRectangle + lcd.drawText "MODEL"
end
```

## Layout rules

### Thumbnail in a card (default)

- Reserve a fixed **72×56** (or 80×60) box — do not overlap DBLSIZE timer text.
- Place top-left of a card or in a dedicated strip; keep 8px inset from card border.
- Add BOOL option `ShowModel` (default on when user requested model image).
- **All `lcd.drawBitmap` calls must be directly in `refresh()`** for web preview.

### Full-screen background (model behind dashboard)

When the user wants the model **behind** the UI or a **hero overview**:

- Draw the bitmap in the **body region only** (between header and footer), then a dim overlay.
- Use **cover** scale (`max` of width/height scale factors), center the image — not `min` (contain), which leaves narrow pillars.
- Dim overlay: `lcd.drawFilledRectangle(0, bodyY, w, bodyH, BLACK, BG_DIM)` where **`BG_DIM` is 0–15** (typical **8–12**). Values like `168` are invalid and break layering.
- Store `BG_DIM` on the widget table in `create()`; draw header/footer **after** the dim layer so chrome stays opaque.

See `knowledge/design/model-hero-dashboard.md` for layer order, rotary gauge placement, and a full reference widget.

## INSTALL.md

Document: copy `model.png` to SD `/MODELS/` or rename to match the model name in Model Setup.
