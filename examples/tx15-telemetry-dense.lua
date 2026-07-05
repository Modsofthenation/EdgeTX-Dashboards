---@type WidgetScript
---@simulate Layout1x1 zone=0
-- Telemetry-dense snippet — small cells in a grid (do NOT copy layout)

local name = "DenseGrid"

local options = {
  { "ShowGPS", BOOL, 1 },
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
      rxbt = cacheSource("RxBt"),
      alt = cacheSource("Alt"),
      gspd = cacheSource("GSpd"),
      curr = cacheSource("Curr"),
      sats = cacheSource("Sats"),
    },
  }
end

local function refresh(widget, event, touchState)
  local w = LCD_W
  local pad = 12
  local cols = 3
  local rows = 2
  local cellW = math.floor((w - pad * 2 - 8 * (cols - 1)) / cols)
  local cellH = 72
  local startY = 40

  lcd.clear(BLACK)

  local cells = {
    { "RQLY", tostring(math.floor(telem(widget.src.rqly) + 0.5)) .. "%" },
    { "VOLT", string.format("%.1f", telem(widget.src.rxbt)) },
    { "CURR", string.format("%.1fA", telem(widget.src.curr)) },
    { "ALT", string.format("%.0f", telem(widget.src.alt)) },
    { "GSPD", string.format("%.0f", telem(widget.src.gspd)) },
    { "SATS", tostring(telem(widget.src.sats)) },
  }

  for i, cell in ipairs(cells) do
    local col = (i - 1) % cols
    local row = math.floor((i - 1) / cols)
    local x = pad + col * (cellW + 8)
    local y = startY + row * (cellH + 8)
    lcd.drawFilledRectangle(x, y, cellW, cellH, DARKGREY)
    lcd.drawRectangle(x, y, cellW, cellH, GREY)
    lcd.drawText(x + 6, y + 6, cell[1], SMLSIZE + GREY)
    lcd.drawText(x + 6, y + 24, cell[2], MIDSIZE + WHITE)
  end
end

return { name = name, options = options, create = create, refresh = refresh }
