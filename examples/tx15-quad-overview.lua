---@type WidgetScript
---@simulate Layout1x1 zone=0
-- Quad overview snippet — timer + bars (do NOT copy layout)

local name = "QuadView"

local options = {
  { "ShowTimer", BOOL, 1 },
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
    src = { rxbt = cacheSource("RxBt"), rqly = cacheSource("RQLY"), fm = cacheSource("FM") },
  }
end

local function refresh(widget, event, touchState)
  local w = LCD_W
  local pad = 12
  lcd.clear(BLACK)

  local rqly = telem(widget.src.rqly)
  local volts = telem(widget.src.rxbt)
  local fm = telem(widget.src.fm)
  local rqlyStr = tostring(math.floor(rqly + 0.5)) .. "%"
  local vStr = string.format("%.1fV", volts)
  local fmStr = tostring(fm)

  lcd.drawFilledRectangle(pad, pad, w - pad * 2, 14, GREY)
  local linkFill = math.floor((w - pad * 2 - 4) * math.max(0, math.min(100, rqly)) / 100)
  if linkFill > 0 then
    lcd.drawFilledRectangle(pad + 2, pad + 2, linkFill, 10, GREEN)
  end

  lcd.drawFilledRectangle(pad, pad + 22, w - pad * 2, 14, GREY)
  local battPct = math.max(0, math.min(100, (volts - 3.3) / (4.2 - 3.3) * 100))
  local battFill = math.floor((w - pad * 2 - 4) * battPct / 100)
  if battFill > 0 then
    lcd.drawFilledRectangle(pad + 2, pad + 24, battFill, 10, YELLOW)
  end

  lcd.drawText(pad, pad + 48, "FM " .. fmStr, SMLSIZE + ORANGE)
  lcd.drawText(w / 2 - 40, pad + 80, "03:42", DBLSIZE + WHITE)
  lcd.drawText(pad, pad + 120, rqlyStr, MIDSIZE + GREEN)
  lcd.drawText(w - pad - 60, pad + 120, vStr, MIDSIZE + YELLOW)
end

return { name = name, options = options, create = create, refresh = refresh }
