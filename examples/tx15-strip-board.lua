---@type WidgetScript
---@simulate Layout1x1 zone=0
-- Strip-board snippet — vertical columns with label + value (do NOT copy layout)

local name = "StripBrd"

local options = {
  { "ShowBatt", BOOL, 1 },
  { "ShowLink", BOOL, 1 },
  { "Accent", COLOR, CYAN },
}

local function cacheSource(sensorName)
  local idx = getSourceIndex(sensorName)
  if idx and idx > 0 then return idx end
  return nil
end

local function telem(id)
  if id then return getValue(id) end
  return 0
end

local function create(zone, opts)
  return {
    zone = zone,
    options = opts,
    src = { rqly = cacheSource("RQLY"), rxbt = cacheSource("RxBt"), curr = cacheSource("Curr") },
  }
end

local function refresh(widget, event, touchState)
  local w = LCD_W
  local h = LCD_H
  local pad = 12
  local cols = 3
  local gutter = 8
  local stripW = math.floor((w - pad * 2 - gutter * (cols - 1)) / cols)
  local topY = 48
  local stripH = h - topY - pad

  lcd.clear(BLACK)
  lcd.drawFilledRectangle(0, 0, w, 36, DARKGREY)
  lcd.drawText(pad, 10, "STRIP BOARD", MIDSIZE + WHITE)

  for i = 0, cols - 1 do
    local x = pad + i * (stripW + gutter)
    lcd.drawFilledRectangle(x, topY, stripW, stripH, DARKGREY)
    lcd.drawRectangle(x, topY, stripW, stripH, widget.options.Accent)
  end

  if widget.options.ShowLink == 1 then
    local x = pad
    local rqly = telem(widget.src.rqly)
    local rqlyStr = tostring(math.floor(rqly + 0.5)) .. "%"
    lcd.drawText(x + 6, topY + 8, "LINK", SMLSIZE + GREY)
    lcd.drawText(x + 6, topY + 28, rqlyStr, MIDSIZE + GREEN)
  end

  if widget.options.ShowBatt == 1 then
    local x = pad + stripW + gutter
    local volts = telem(widget.src.rxbt)
    local vStr = string.format("%.1fV", volts)
    lcd.drawText(x + 6, topY + 8, "BATT", SMLSIZE + GREY)
    lcd.drawText(x + 6, topY + 28, vStr, MIDSIZE + YELLOW)
  end

  local x = pad + 2 * (stripW + gutter)
  local amps = telem(widget.src.curr)
  local aStr = string.format("%.1fA", amps)
  lcd.drawText(x + 6, topY + 8, "CURR", SMLSIZE + GREY)
  lcd.drawText(x + 6, topY + 28, aStr, MIDSIZE + widget.options.Accent)
end

return { name = name, options = options, create = create, refresh = refresh }
