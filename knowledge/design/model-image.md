# Model image in dashboards

When the user asks for a **model photo**, **plane/heli image**, or **model picture** on the dashboard, include an optional model-image region.

## SD card path (same as Model Info widget)

EdgeTX model images live on the radio SD card under **`/IMAGES/`** (PNG, filename ≤ 9 characters before extension).

The user assigns the image in **Model Setup → Assign Bitmap**. The filename is returned by **`model.getInfo().bitmap`** — use that name, not a hardcoded `/MODELS/` path.

```lua
local function loadModelBitmap()
  local info = model.getInfo()
  local name = info and info.bitmap or ""
  if name == nil or name == "" then
    return nil, 0, 0
  end
  local bmp = Bitmap.open("/IMAGES/" .. name)
  if bmp == nil then
    return nil, 0, 0
  end
  local w, h = Bitmap.getSize(bmp)
  return bmp, w, h
end
```

Ideal size for the Model Info widget: **192×114** (thumbnails **156×92**).

## Layout / simulator preview

In the Layout editor, use toolbar **Model PNG…** to drop a PNG into the WASM sim virtual SD (`/IMAGES/simmodel.png`). That path matches `model.getInfo().bitmap` in the simulator model YAML so `lcd.drawBitmap(widget.modelBmp, …)` shows the uploaded image instead of the grey placeholder.

On the radio, continue to assign the bitmap under **Model Setup → Assign Bitmap** (real `/IMAGES/<name>.png` on the SD card). Desktop install may also copy a PNG under `IMAGES/` when included in the package file list.

## Widget pattern (required for web preview)

Load once in `create()`, reload in `update()` if the model bitmap may change, draw in `refresh()` with a **placeholder fallback** when width/height are 0.

**Common crash:** passing the SD path to `Bitmap.getSize` — use the bitmap handle only (see `runtime-api-pitfalls.md`).

```lua
local function create(zone, opts)
  local modelBmp, bmpW, bmpH = loadModelBitmap()

  return {
    zone = zone,
    options = opts,
    modelBmp = modelBmp,
    bmpW = bmpW,
    bmpH = bmpH,
    src = { ... },
  }
end

local function update(widget, opts)
  widget.options = opts
  local modelBmp, bmpW, bmpH = loadModelBitmap()
  widget.modelBmp = modelBmp
  widget.bmpW = bmpW
  widget.bmpH = bmpH
end

-- Inside refresh(), when ShowModel option enabled:
local imgW = 72
local imgH = 56
local imgX = leftX + 8
local imgY = cardY + 8

if widget.options.ShowModel == 1 then
  if widget.bmpW > 0 and widget.bmpH > 0 then
    lcd.drawBitmap(widget.modelBmp, imgX, imgY)
  else
    lcd.drawFilledRectangle(imgX, imgY, imgW, imgH, DARKGREY)
    lcd.drawText(imgX + math.floor(imgW / 2), imgY + math.floor(imgH / 2) - 6, "MODEL", SMLSIZE + CENTER + GREY)
  end
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

Document: assign a model bitmap in **Model Setup → Assign Bitmap** (PNG in SD `/IMAGES/`). The widget uses the assigned image automatically — no extra copy step unless the user has not assigned one yet.
