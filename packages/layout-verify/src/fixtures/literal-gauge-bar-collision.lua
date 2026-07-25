---@type WidgetScript
---@simulate Layout1x1 zone=0
-- Minimal literal fixture: annulus intrudes into right bar text (BfGenemt class)

local name = "OverlapQA"

local function create(zone, opts)
  return { zone = zone, options = opts }
end

local function refresh(widget, event, touchState)
  local w = LCD_W
  local pad = 12
  local barW = math.floor((w - pad * 3) / 2)
  local rightBarX = pad * 2 + barW
  local gaugeCx = math.floor(w / 2)
  local gaugeCy = 88
  local rIn = 40
  local rOut = 52

  lcd.clear(BLACK)
  lcd.drawFilledRectangle(0, 72, w, 38, GREY)
  lcd.drawAnnulus(gaugeCx, gaugeCy, rIn, rOut, 135, 360, CYAN)
  lcd.drawText(pad, 76, "LINK", SMLSIZE + BLACK)
  lcd.drawText(rightBarX, 76, "BATTERY", SMLSIZE + BLACK)
  lcd.drawText(rightBarX + barW - 4, 88, "78%", SMLSIZE + RIGHT + YELLOW)
end

return {
  name = name,
  create = create,
  refresh = refresh,
}
