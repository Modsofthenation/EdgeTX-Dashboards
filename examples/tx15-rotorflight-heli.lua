---@type WidgetScript
---@simulate Layout1x1 zone=0
-- TX15 Rotorflight heli reference — gold standard for heli dashboards (480x320)

local name = "HeliRef"

local options = {
  { "ShowLink", BOOL, 1 },
  { "ShowBatt", BOOL, 1 },
  { "ShowHead", BOOL, 1 },
  { "ShowMotor", BOOL, 1 },
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
      batpct = cacheSource("Bat%"),
      hspd = cacheSource("HSpd"),
      rpm = cacheSource("RPM"),
      esct = cacheSource("EscT"),
      mott = cacheSource("MotT"),
      adjv = cacheSource("AdjV"),
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
  local headerH = 40
  local footerH = 28
  local cardH = 118
  local colW = math.floor((w - pad * 3) / 2)
  local cardY = headerH + pad
  local leftX = pad
  local rightX = pad * 2 + colW
  local row2Y = cardY + cardH + pad
  local row2H = h - row2Y - footerH - pad

  lcd.clear(BLACK)

  lcd.drawFilledRectangle(0, 0, w, headerH, GREY)
  lcd.drawText(pad, 12, "Heli Dash", MIDSIZE + WHITE)

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

  if widget.options.ShowHead == 1 then
    local hspd = telem(widget.src.hspd)
    local hspdStr = "--"
    if hspd > 0 then
      hspdStr = tostring(math.floor(hspd + 0.5))
    end
    lcd.drawFilledRectangle(pad, row2Y, w - pad * 2, row2H, DARKGREY)
    lcd.drawRectangle(pad, row2Y, w - pad * 2, row2H, GREY)
    lcd.drawText(pad + 8, row2Y + 8, "HEADSPEED", SMLSIZE + GREY)
    lcd.drawText(pad + 8, row2Y + 28, hspdStr, DBLSIZE + CYAN)
    lcd.drawText(pad + 120, row2Y + 36, "rpm", SMLSIZE + GREY)
  end

  if widget.options.ShowMotor == 1 then
    local rpm = telem(widget.src.rpm)
    local esct = telem(widget.src.esct)
    local mott = telem(widget.src.mott)
    local adjv = telem(widget.src.adjv)
    local rpmStr = rpm > 0 and tostring(math.floor(rpm + 0.5)) or "--"
    local escStr = esct > 0 and tostring(math.floor(esct + 0.5)) or "--"
    local motStr = mott > 0 and tostring(math.floor(mott + 0.5)) or "--"
    local adjStr = adjv ~= 0 and tostring(adjv) or "--"
    lcd.drawText(pad + 8, row2Y + 72, "RPM " .. rpmStr, MIDSIZE + WHITE)
    lcd.drawText(pad + 140, row2Y + 72, "ESC " .. escStr .. "C", SMLSIZE + WHITE)
    lcd.drawText(pad + 240, row2Y + 72, "MOT " .. motStr .. "C", SMLSIZE + WHITE)
    lcd.drawText(pad + 340, row2Y + 72, "ADJ " .. adjStr, SMLSIZE + ORANGE)
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
