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

  if widget.options.ShowLink == 1 then
    local rqly = telem(widget.src.rqly)
    local rqlyStr = tostring(math.floor(rqly + 0.5)) .. "%"
    lcd.drawFilledRectangle(pad, headerH + pad, colW, 100, DARKGREY)
    lcd.drawRectangle(pad, headerH + pad, colW, 100, GREY)
    lcd.drawText(pad + 8, headerH + pad + 8, "LINK", SMLSIZE + GREY)
    lcd.drawText(pad + 8, headerH + pad + 24, rqlyStr, MIDSIZE + GREEN)
    local barW = colW - 16
    local barY = headerH + pad + 72
    lcd.drawFilledRectangle(pad + 8, barY, barW, 10, GREY)
    local fillW = math.floor(barW * math.max(0, math.min(100, rqly)) / 100)
    if fillW > 0 then
      lcd.drawFilledRectangle(pad + 8, barY, fillW, 10, GREEN)
    end
  end

  if widget.options.ShowBatt == 1 then
    local volts = telem(widget.src.rxbt)
    local vStr = string.format("%.1f", volts)
    local rx = pad * 2 + colW
    lcd.drawFilledRectangle(rx, headerH + pad, colW, 100, DARKGREY)
    lcd.drawRectangle(rx, headerH + pad, colW, 100, GREY)
    lcd.drawText(rx + 8, headerH + pad + 8, "BATTERY", SMLSIZE + GREY)
    lcd.drawText(rx + 8, headerH + pad + 22, vStr, DBLSIZE + YELLOW)
  end

  if widget.options.ShowGPS == 1 then
    local gy = headerH + pad + 112
    local altStr = tostring(telem(widget.src.alt))
    local spdStr = tostring(telem(widget.src.gspd))
    local satsStr = tostring(telem(widget.src.sats))
    local altLine = "Alt " .. altStr .. " m"
    local spdLine = "Spd " .. spdStr .. " km/h"
    local satsLine = "Sats " .. satsStr
    lcd.drawFilledRectangle(pad, gy, w - pad * 2, 64, DARKGREY)
    lcd.drawRectangle(pad, gy, w - pad * 2, 64, GREY)
    lcd.drawText(pad + 8, gy + 8, altLine, MIDSIZE + fg)
    lcd.drawText(pad + 8, gy + 30, spdLine, SMLSIZE + fg)
    lcd.drawText(pad + 200, gy + 8, satsLine, SMLSIZE + fg)
  end

  local fm = telem(widget.src.fm)
  if type(fm) == "string" and fm ~= "" then
    lcd.drawText(pad, h - 20, fm, SMLSIZE + fg)
  end
end

return {
  name = name,
  options = options,
  create = create,
  update = update,
  refresh = refresh,
}
`;
