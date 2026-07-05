# Model image in dashboards

When the user asks for a **model photo**, **plane/heli image**, or **model picture** on the dashboard, include an optional model-image region.

## SD card path

EdgeTX model images live on the radio SD card:

- `/MODELS/<modelname>.png` — model image selected in Model Setup
- Use `Bitmap.open("/MODELS/model.png")` as a documented default; mention in INSTALL.md that users should copy their model PNG or match the filename to their model.

## Widget pattern (required for web preview)

Load once in `create()`, draw in `refresh()` with a **placeholder fallback** so the web preview and radio both look correct when the file is missing.

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

- Reserve a fixed **72×56** (or 80×60) box — do not overlap DBLSIZE timer text.
- Place top-left of a card or in a dedicated strip; keep 8px inset from card border.
- Add BOOL option `ShowModel` (default on when user requested model image).
- **All `lcd.drawBitmap` calls must be directly in `refresh()`** for web preview.

## INSTALL.md

Document: copy `model.png` to SD `/MODELS/` or rename to match the model name in Model Setup.
