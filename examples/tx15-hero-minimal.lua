---@type WidgetScript
---@simulate Layout1x1 zone=0
-- Hero-minimal snippet — one DBLSIZE hero, corner secondaries (do NOT copy layout)

local name = "HeroDash"

local options = {
  { "ShowAlt", BOOL, 1 },
  { "ValueColor", COLOR, YELLOW },
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
    src = { rxbt = cacheSource("RxBt"), alt = cacheSource("Alt"), rqly = cacheSource("RQLY") },
  }
end

local function refresh(widget, event, touchState)
  local w = LCD_W
  local pad = 12
  lcd.clear(BLACK)

  local volts = telem(widget.src.rxbt)
  local vStr = string.format("%.1f", volts)
  local alt = telem(widget.src.alt)
  local altStr = string.format("%.0f", alt)
  local rqly = telem(widget.src.rqly)
  local rqlyStr = tostring(math.floor(rqly + 0.5)) .. "%"

  lcd.drawText(w - pad - 80, pad + 8, "BATT", SMLSIZE + GREY)
  lcd.drawText(w - pad - 120, pad + 28, vStr, DBLSIZE + widget.options.ValueColor)
  lcd.drawText(w - pad - 40, pad + 28, "V", SMLSIZE + WHITE)

  lcd.drawText(pad, pad + 8, "LINK", SMLSIZE + GREY)
  lcd.drawText(pad, pad + 28, rqlyStr, MIDSIZE + GREEN)

  if widget.options.ShowAlt == 1 then
    lcd.drawText(pad, pad + 64, "ALT " .. altStr, SMLSIZE + CYAN)
  end
end

return { name = name, options = options, create = create, refresh = refresh }
