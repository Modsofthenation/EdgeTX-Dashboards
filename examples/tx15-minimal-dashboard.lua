---@type WidgetScript
---@simulate Layout1x1 zone=0
-- TX15 reference dashboard — clean card layout (480x320, Betaflight CRSF)
-- Gold standard for generated widgets: follow this visual structure.

local name = "TX15Dash"

local options = {
  { "ShowLink", BOOL, 1 },
  { "ShowBatt", BOOL, 1 },
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
      rssi = cacheSource("1RSS"),
      rxbt = cacheSource("RxBt"),
      curr = cacheSource("Curr"),
      alt = cacheSource("Alt"),
      gspd = cacheSource("GSpd"),
      sats = cacheSource("Sats"),
      fm = cacheSource("FM"),
    },
    C_ACCENT = lcd.RGB(0, 210, 255),
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
  local footerH = 28
  local cardH = 118
  local colW = math.floor((w - pad * 3) / 2)
  local cardY = headerH + pad
  local leftX = pad
  local rightX = pad * 2 + colW

  lcd.clear(BLACK)

  lcd.drawFilledRectangle(0, 0, w, headerH, GREY)
  lcd.drawText(pad, 12, "TX15 Dash", MIDSIZE + WHITE)

  if widget.options.ShowLink == 1 then
    local rqly = telem(widget.src.rqly)
    local rssi = telem(widget.src.rssi)
    lcd.drawFilledRectangle(leftX, cardY, colW, cardH, DARKGREY)
    lcd.drawRectangle(leftX, cardY, colW, cardH, GREY)
    lcd.drawText(leftX + 8, cardY + 8, "LINK", SMLSIZE + GREY)
    lcd.drawText(leftX + 8, cardY + 24, tostring(rqly) .. "%", MIDSIZE + GREEN)
    lcd.drawText(leftX + 8, cardY + 44, "RSSI " .. tostring(rssi), SMLSIZE + WHITE)
    local barW = colW - 16
    local barY = cardY + cardH - 22
    lcd.drawFilledRectangle(leftX + 8, barY, barW, 10, GREY)
    local fillW = math.floor(barW * math.max(0, math.min(100, rqly)) / 100)
    if fillW > 0 then
      lcd.drawFilledRectangle(leftX + 8, barY, fillW, 10, GREEN)
    end
  end

  if widget.options.ShowBatt == 1 then
    local volts = telem(widget.src.rxbt)
    local amps = telem(widget.src.curr)
    lcd.drawFilledRectangle(rightX, cardY, colW, cardH, DARKGREY)
    lcd.drawRectangle(rightX, cardY, colW, cardH, GREY)
    lcd.drawText(rightX + 8, cardY + 8, "BATTERY", SMLSIZE + GREY)
    lcd.drawText(rightX + 8, cardY + 22, string.format("%.1f", volts), DBLSIZE + YELLOW)
    lcd.drawText(rightX + 8, cardY + 50, "V", SMLSIZE + WHITE)
    lcd.drawText(rightX + 8, cardY + 72, string.format("%.1f A", amps), SMLSIZE + WHITE)
  end

  if widget.options.ShowGPS == 1 then
    local gpsY = cardY + cardH + pad
    local gpsH = h - gpsY - footerH - pad
    lcd.drawFilledRectangle(pad, gpsY, w - pad * 2, gpsH, DARKGREY)
    lcd.drawRectangle(pad, gpsY, w - pad * 2, gpsH, GREY)
    lcd.drawText(pad + 8, gpsY + 8, "GPS", SMLSIZE + GREY)
    local alt = telem(widget.src.alt)
    local spd = telem(widget.src.gspd)
    local sats = telem(widget.src.sats)
    lcd.drawText(pad + 8, gpsY + 26, tostring(alt), MIDSIZE + WHITE)
    lcd.drawText(pad + 8, gpsY + 44, "m alt", SMLSIZE + GREY)
    lcd.drawText(pad + 120, gpsY + 26, tostring(spd), MIDSIZE + WHITE)
    lcd.drawText(pad + 120, gpsY + 44, "km/h", SMLSIZE + GREY)
    lcd.drawText(pad + 240, gpsY + 26, tostring(sats), MIDSIZE + widget.C_ACCENT)
    lcd.drawText(pad + 240, gpsY + 44, "sats", SMLSIZE + GREY)
  end

  local fm = telem(widget.src.fm)
  lcd.drawFilledRectangle(0, h - footerH, w, footerH, DARKGREY)
  if type(fm) == "string" and fm ~= "" then
    lcd.drawText(pad, h - footerH + 8, fm, SMLSIZE + ORANGE)
  else
    lcd.drawText(pad, h - footerH + 8, "Ready", SMLSIZE + GREY)
  end
end

return {
  name = name,
  options = options,
  create = create,
  update = update,
  refresh = refresh,
}
