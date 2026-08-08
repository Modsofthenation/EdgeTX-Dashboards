/** Minimal valid TX15 Betaflight dashboard (mirrors examples/tx15-minimal-dashboard.lua). */
export const VALID_MINIMAL_LUA = `---@type WidgetScript
---@simulate Layout1x1 zone=0
-- E2E fixture — valid Betaflight CRSF dashboard

local name = "E2EDash"

local options = {
  { "ShowLink", BOOL, 1 },
  { "ShowBatt", BOOL, 1 },
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
    src = {
      rqly = cacheSource("RQLY"),
      rssi = cacheSource("1RSS"),
      rxbt = cacheSource("RxBt"),
      curr = cacheSource("Curr"),
    },
  }
end

local function update(widget, opts)
  widget.options = opts
end

local function refresh(widget, event, touchState)
  local w = LCD_W
  local h = LCD_H
  local pad = 12
  local headerH = 40
  local cardH = 118
  local colW = math.floor((w - pad * 3) / 2)
  local cardY = headerH + pad
  local leftX = pad
  local rightX = pad * 2 + colW

  lcd.clear(BLACK)

  lcd.drawFilledRectangle(0, 0, w, headerH, GREY)
  lcd.drawText(pad, 12, "E2E Dash", MIDSIZE + WHITE)

  if widget.options.ShowLink == 1 then
    local rqly = telem(widget.src.rqly)
    local rssi = telem(widget.src.rssi)
    lcd.drawFilledRectangle(leftX, cardY, colW, cardH, DARKGREY)
    lcd.drawRectangle(leftX, cardY, colW, cardH, GREY)
    lcd.drawText(leftX + 8, cardY + 8, "LINK", SMLSIZE + GREY)
    lcd.drawText(leftX + 8, cardY + 24, tostring(rqly) .. "%", MIDSIZE + GREEN)
    lcd.drawText(leftX + 8, cardY + 44, "RSSI " .. tostring(rssi), SMLSIZE + WHITE)
  end

  if widget.options.ShowBatt == 1 then
    local rxbt = telem(widget.src.rxbt)
    local curr = telem(widget.src.curr)
    lcd.drawFilledRectangle(rightX, cardY, colW, cardH, DARKGREY)
    lcd.drawRectangle(rightX, cardY, colW, cardH, GREY)
    lcd.drawText(rightX + 8, cardY + 8, "BATTERY", SMLSIZE + GREY)
    lcd.drawText(rightX + 8, cardY + 24, string.format("%.1fV", rxbt), MIDSIZE + WHITE)
    lcd.drawText(rightX + 8, cardY + 44, string.format("%.1fA", curr), SMLSIZE + WHITE)
  end

  lcd.drawFilledRectangle(0, h - 28, w, 28, GREY)
  lcd.drawText(pad, h - 20, "E2E", SMLSIZE + WHITE)
end

return { name = name, options = options, create = create, update = update, refresh = refresh }
`;

/** Intentionally invalid Lua — missing WidgetScript contract pieces. */
export const INVALID_LUA = `-- broken e2e fixture
local function refresh()
  lcd.clear(BLACK)
end
return { name = "Bad" }
`;

/** Intentionally different palette from VALID_MINIMAL_LUA — for hot-reload E2E. */
export const HOT_RELOAD_ALT_LUA = `---@type WidgetScript
---@simulate Layout1x1 zone=0
-- E2E fixture — hot-reload alternate (solid orange board)

local name = "E2EDash"

local options = {}

local function create(zone, opts)
  return { zone = zone, options = opts }
end

local function update(widget, opts)
  widget.options = opts
end

local function refresh(widget)
  lcd.clear(ORANGE)
  lcd.drawFilledRectangle(24, 24, LCD_W - 48, LCD_H - 48, RED)
  lcd.drawText(40, 60, "HOT RELOAD", DBLSIZE + WHITE)
  lcd.drawText(40, 120, "ALT BOARD", MIDSIZE + BLACK)
end

return { name = name, options = options, create = create, update = update, refresh = refresh }
`;

/** Valid structure but unknown telemetry sensor (strict catalog should fail). */
export const INVALID_TELEMETRY_LUA = `---@type WidgetScript
---@simulate Layout1x1 zone=0

local name = "BadTelem"

local options = {}

local function create(zone, opts)
  return {
    zone = zone,
    options = opts,
    src = {
      nope = getSourceIndex("NOT_A_REAL_SENSOR_XYZ"),
    },
  }
end

local function update(widget, opts)
  widget.options = opts
end

local function refresh(widget)
  lcd.clear(BLACK)
  lcd.drawFilledRectangle(12, 12, 200, 80, DARKGREY)
  lcd.drawText(20, 28, "Bad", MIDSIZE + WHITE)
end

return { name = name, options = options, create = create, update = update, refresh = refresh }
`;
