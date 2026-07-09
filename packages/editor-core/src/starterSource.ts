/** Default widget source for new editor documents — mirrors templates/dashboard-starter.lua */
export const STARTER_WIDGET_SOURCE = `---@type WidgetScript
---@simulate Layout1x1 zone=0
-- EdgeTX dashboard starter — clean card layout for TX15 (480x320)

local name = "DashStart"

local options = {
  { "ShowLink", BOOL, 1 },
  { "ShowBatt", BOOL, 1 },
  { "ShowGPS", BOOL, 1 },
  { "TextColor", COLOR, WHITE },
  { "BgColor", COLOR, BLACK },
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
      curr = cacheSource("Curr"),
      alt = cacheSource("Alt"),
      gspd = cacheSource("GSpd"),
      sats = cacheSource("Sats"),
      fm = cacheSource("FM"),
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
  local fg = widget.options.TextColor
  local bg = widget.options.BgColor
  local headerH = 36
  local colW = math.floor((w - pad * 3) / 2)

  lcd.clear(bg)

  lcd.drawFilledRectangle(0, 0, w, headerH, GREY)
  lcd.drawText(pad, 10, name, MIDSIZE + fg)
end

return {
  name = name,
  options = options,
  create = create,
  update = update,
  refresh = refresh,
}
`;
