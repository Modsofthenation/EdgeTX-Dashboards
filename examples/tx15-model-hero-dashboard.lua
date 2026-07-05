---@type WidgetScript
---@simulate Layout1x1 zone=0
-- TX15 model-background + rotary battery gauge (quad / tinywhoop overview)
-- Gold standard for model-hero layouts — see knowledge/design/model-hero-dashboard.md

local name = "TXModelHr"

-- TX15 lcd.drawText line heights (px) — knowledge/design/tx15-text-layout.md
local LH = { SML = 12, MID = 18, DBL = 26, GAP = 4, SEC = 8 }

local function loadModelBitmap()
  local info = model.getInfo()
  local name = info and info.bitmap or ""
  if name == nil or name == "" then
    return nil, 0, 0
  end
  local bmp = Bitmap.open("/IMAGES/" .. name)
  if bmp == nil then
    return nil, 0, 0
  end
  local w, h = Bitmap.getSize(bmp)
  return bmp, w, h
end

local options = {
  { "ShowModel", BOOL, 1 },
  { "ShowLink", BOOL, 1 },
  { "ShowGPS", BOOL, 0 },
  { "ShowAtt", BOOL, 1 },
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

local function attDeg(v)
  if v == 0 then return nil end
  if math.abs(v) <= 2 then
    return math.floor(v * 57.3 + 0.5)
  end
  return math.floor(v + 0.5)
end

local function create(zone, opts)
  local modelBmp, bmpW, bmpH = loadModelBitmap()

  return {
    zone = zone,
    options = opts,
    modelBmp = modelBmp,
    bmpW = bmpW,
    bmpH = bmpH,
    BG_DIM = 10,
    C_CARD = lcd.RGB(36, 38, 48),
    C_BORDER = MAGENTA,
    src = {
      rqly = cacheSource("RQLY"),
      trss = cacheSource("TRSS"),
      rxbt = cacheSource("RxBt"),
      curr = cacheSource("Curr"),
      capa = cacheSource("Capa"),
      batpct = cacheSource("Bat%"),
      alt = cacheSource("Alt"),
      gspd = cacheSource("GSpd"),
      sats = cacheSource("Sats"),
      fm = cacheSource("FM"),
      ptch = cacheSource("Ptch"),
      roll = cacheSource("Roll"),
    },
  }
end

local function update(widget, opts)
  widget.options = opts
  local modelBmp, bmpW, bmpH = loadModelBitmap()
  widget.modelBmp = modelBmp
  widget.bmpW = bmpW
  widget.bmpH = bmpH
end

local function refresh(widget, event, touchState)
  local w = LCD_W
  local h = LCD_H
  local pad = 12
  local headerH = 40
  local footerH = 28
  local contentTop = headerH + pad
  local contentBottom = h - footerH - pad
  local cr = 8
  local crSm = 6

  lcd.clear(BLACK)

  local rqly = telem(widget.src.rqly)
  local trss = telem(widget.src.trss)
  local volts = telem(widget.src.rxbt)
  local amps = telem(widget.src.curr)
  local capa = telem(widget.src.capa)
  local batpct = telem(widget.src.batpct)
  local alt = telem(widget.src.alt)
  local gspd = telem(widget.src.gspd)
  local sats = telem(widget.src.sats)
  local fm = telem(widget.src.fm)
  local ptch = telem(widget.src.ptch)
  local roll = telem(widget.src.roll)

  local batPctVal = batpct
  if batPctVal <= 0 and volts > 0 then
    batPctVal = math.max(0, math.min(100, (volts - 3.3) / (4.2 - 3.3) * 100))
  end

  local rqlyPct = math.max(0, math.min(100, rqly))
  local linkFillPct = math.floor(rqlyPct + 0.5)
  local battFillPct = math.floor(batPctVal + 0.5)

  local voltsStr = "--"
  if volts > 0 then
    voltsStr = string.format("%.1f", volts)
  end

  local ampsStr = "--"
  if amps ~= 0 then
    ampsStr = string.format("%.1f", amps)
  end

  local capaStr = "--"
  if capa > 0 then
    capaStr = tostring(math.floor(capa + 0.5))
  end

  local batPctStr = "--"
  if batPctVal > 0 then
    batPctStr = tostring(battFillPct) .. "%"
  end

  local rqlyStr = tostring(linkFillPct) .. "%"
  local trssStr = "--"
  if trss ~= 0 then
    trssStr = tostring(math.floor(trss + 0.5))
  end

  local altStr = "--"
  if alt ~= 0 then
    altStr = tostring(math.floor(alt + 0.5))
  end

  local gspdStr = "--"
  if gspd ~= 0 then
    gspdStr = string.format("%.1f", gspd)
  end

  local satsStr = "--"
  if sats > 0 then
    satsStr = tostring(sats)
  end

  local fmStr = "DISARM"
  local armed = false
  if type(fm) == "string" and fm ~= "" then
    fmStr = fm
    local upper = string.upper(fm)
    if string.find(upper, "ARM") and not string.find(upper, "DISARM") then
      armed = true
    end
  end

  local rollDeg = attDeg(roll)
  local ptchDeg = attDeg(ptch)
  local rollStr = "--"
  local ptchStr = "--"
  if rollDeg then rollStr = tostring(rollDeg) end
  if ptchDeg then ptchStr = tostring(ptchDeg) end

  local bodyY = headerH
  local bodyH = h - headerH - footerH

  if widget.options.ShowModel == 1 then
    if widget.bmpW > 0 and widget.bmpH > 0 then
      local bodyW = w
      local scaleX = math.floor(bodyW * 100 / widget.bmpW)
      local scaleY = math.floor(bodyH * 100 / widget.bmpH)
      local bmpScale = scaleX
      if scaleY > bmpScale then
        bmpScale = scaleY
      end
      local drawW = math.floor(widget.bmpW * bmpScale / 100)
      local drawH = math.floor(widget.bmpH * bmpScale / 100)
      local imgX = math.floor((w - drawW) / 2)
      local imgY = math.floor(bodyY + (bodyH - drawH) / 2)
      lcd.drawBitmap(widget.modelBmp, imgX, imgY, bmpScale)
    end
    lcd.drawFilledRectangle(0, bodyY, w, bodyH, BLACK, widget.BG_DIM)
  end

  lcd.drawFilledRectangle(0, 0, w, headerH, widget.C_CARD)
  lcd.drawFilledRectangle(pad, headerH - 2, w - pad * 2, 2, MAGENTA)
  local titleY = math.floor((headerH - LH.MID) / 2)
  local subY = math.floor((headerH - LH.SML) / 2)
  lcd.drawText(pad, titleY, "TINYWHOOP", MIDSIZE + MAGENTA)
  lcd.drawText(w - pad, subY, "BF CRSF", SMLSIZE + RIGHT + CYAN)

  local topBarH = 30
  local topBarY = contentTop
  local barW = math.floor((w - pad * 3) / 2)
  local leftBarX = pad
  local rightBarX = pad * 2 + barW
  local barInset = 4

  if widget.options.ShowLink == 1 then
    lcd.drawFilledRectangle(leftBarX, topBarY + crSm, barW, topBarH - 2 * crSm, widget.C_CARD)
    lcd.drawFilledRectangle(leftBarX + crSm, topBarY, barW - 2 * crSm, topBarH, widget.C_CARD)
    lcd.drawFilledCircle(leftBarX + crSm, topBarY + crSm, crSm, widget.C_CARD)
    lcd.drawFilledCircle(leftBarX + barW - crSm, topBarY + crSm, crSm, widget.C_CARD)
    lcd.drawFilledCircle(leftBarX + crSm, topBarY + topBarH - crSm, crSm, widget.C_CARD)
    lcd.drawFilledCircle(leftBarX + barW - crSm, topBarY + topBarH - crSm, crSm, widget.C_CARD)

    lcd.drawText(leftBarX + 8, topBarY + barInset, "LINK", SMLSIZE + LIGHTGREY)
    lcd.drawText(leftBarX + barW - 8, topBarY + barInset, rqlyStr, SMLSIZE + RIGHT + CYAN)

    local trackX = leftBarX + 8
    local trackY = topBarY + barInset + LH.SML + LH.GAP
    local trackW = barW - 16
    local trackH = 8
    lcd.drawFilledRectangle(trackX, trackY, trackW, trackH, GREY)
    local linkFillW = math.floor(trackW * rqlyPct / 100)
    if linkFillW > 0 then
      lcd.drawFilledRectangle(trackX, trackY, linkFillW, trackH, CYAN)
    end
  end

  lcd.drawFilledRectangle(rightBarX, topBarY + crSm, barW, topBarH - 2 * crSm, widget.C_CARD)
  lcd.drawFilledRectangle(rightBarX + crSm, topBarY, barW - 2 * crSm, topBarH, widget.C_CARD)
  lcd.drawFilledCircle(rightBarX + crSm, topBarY + crSm, crSm, widget.C_CARD)
  lcd.drawFilledCircle(rightBarX + barW - crSm, topBarY + crSm, crSm, widget.C_CARD)
  lcd.drawFilledCircle(rightBarX + crSm, topBarY + topBarH - crSm, crSm, widget.C_CARD)
  lcd.drawFilledCircle(rightBarX + barW - crSm, topBarY + topBarH - crSm, crSm, widget.C_CARD)

  lcd.drawText(rightBarX + 8, topBarY + barInset, "BATT", SMLSIZE + LIGHTGREY)
  lcd.drawText(rightBarX + barW - 8, topBarY + barInset, batPctStr, SMLSIZE + RIGHT + ORANGE)

  local battTrackX = rightBarX + 8
  local battTrackY = topBarY + barInset + LH.SML + LH.GAP
  local battTrackW = barW - 16
  local battTrackH = 8
  lcd.drawFilledRectangle(battTrackX, battTrackY, battTrackW, battTrackH, GREY)
  local battFillW = math.floor(battTrackW * batPctVal / 100)
  if battFillW > 0 then
    lcd.drawFilledRectangle(battTrackX, battTrackY, battFillW, battTrackH, ORANGE)
  end

  local mainTop = topBarY + topBarH + pad
  local gpsH = 0
  local gpsY = contentBottom
  if widget.options.ShowGPS == 1 then
    gpsH = 44
    gpsY = contentBottom - gpsH
  end
  local mainH = contentBottom - mainTop
  if gpsH > 0 then
    mainH = gpsY - mainTop - pad
  end

  local heroW = math.floor(w * 0.52)
  local gaugeCx = math.floor(heroW / 2)
  local gaugeCy = mainTop + math.floor(mainH / 2)
  local rIn = 42
  local rOut = 56
  local startA = 135
  local span = 270
  local trackEndA = startA + span
  local valA = startA + span * (batPctVal / 100)

  if trackEndA > 360 then
    lcd.drawAnnulus(gaugeCx, gaugeCy, rIn, rOut, startA, 360, GREY)
    lcd.drawAnnulus(gaugeCx, gaugeCy, rIn, rOut, 0, trackEndA - 360, GREY)
  else
    lcd.drawAnnulus(gaugeCx, gaugeCy, rIn, rOut, startA, trackEndA, GREY)
  end
  if batPctVal > 0 then
    if valA > 360 then
      lcd.drawAnnulus(gaugeCx, gaugeCy, rIn, rOut, startA, 360, ORANGE)
      lcd.drawAnnulus(gaugeCx, gaugeCy, rIn, rOut, 0, valA - 360, ORANGE)
    else
      lcd.drawAnnulus(gaugeCx, gaugeCy, rIn, rOut, startA, valA, ORANGE)
    end
  end

  lcd.drawFilledCircle(gaugeCx, gaugeCy, rIn - 4, BLACK)

  local gaugeBlockH = LH.DBL + LH.GAP + LH.SML
  local yVolt = gaugeCy - math.floor(gaugeBlockH / 2)
  local yVUnit = yVolt + LH.DBL + LH.GAP
  lcd.drawText(gaugeCx, yVolt, voltsStr, DBLSIZE + CENTER + ORANGE)
  lcd.drawText(gaugeCx, yVUnit, "V", SMLSIZE + CENTER + LIGHTGREY)

  local cardX = heroW + pad
  local cardW = w - cardX - pad
  local cardY = mainTop
  local cardH = mainH

  lcd.drawFilledRectangle(cardX, cardY + cr, cardW, cardH - 2 * cr, widget.C_CARD)
  lcd.drawFilledRectangle(cardX + cr, cardY, cardW - 2 * cr, cardH, widget.C_CARD)
  lcd.drawFilledCircle(cardX + cr, cardY + cr, cr, widget.C_CARD)
  lcd.drawFilledCircle(cardX + cardW - cr, cardY + cr, cr, widget.C_CARD)
  lcd.drawFilledCircle(cardX + cr, cardY + cardH - cr, cr, widget.C_CARD)
  lcd.drawFilledCircle(cardX + cardW - cr, cardY + cardH - cr, cr, widget.C_CARD)

  lcd.drawFilledRectangle(cardX, cardY, cardW, 2, MAGENTA)

  local valX = cardX + 12
  local attX = cardX + cardW - 12
  local y = cardY + 10

  local yPowerLbl = y
  y = y + LH.SML + LH.GAP
  local yPowerVal = y
  y = y + LH.MID + LH.GAP
  local yPowerUnit = y
  y = y + LH.SML + LH.SEC
  local yUsedLbl = y
  y = y + LH.SML + LH.GAP
  local yUsedVal = y
  y = y + LH.MID + LH.GAP
  local yUsedUnit = y

  lcd.drawText(valX, yPowerLbl, "POWER", SMLSIZE + LIGHTGREY)
  lcd.drawText(valX, yPowerVal, ampsStr, MIDSIZE + CYAN)
  lcd.drawText(valX, yPowerUnit, "A", SMLSIZE + LIGHTGREY)
  lcd.drawText(valX, yUsedLbl, "USED", SMLSIZE + LIGHTGREY)
  lcd.drawText(valX, yUsedVal, capaStr, MIDSIZE + ORANGE)
  lcd.drawText(valX, yUsedUnit, "mAh", SMLSIZE + LIGHTGREY)

  if widget.options.ShowAtt == 1 then
    lcd.drawText(attX, yPowerVal, rollStr, MIDSIZE + RIGHT + WHITE)
    lcd.drawText(attX, yPowerUnit, "R", SMLSIZE + RIGHT + LIGHTGREY)
    lcd.drawText(attX, yUsedVal, ptchStr, MIDSIZE + RIGHT + WHITE)
    lcd.drawText(attX, yUsedUnit, "P", SMLSIZE + RIGHT + LIGHTGREY)
  end

  if widget.options.ShowGPS == 1 then
    local gpsW = w - pad * 2
    local gpsX = pad
    lcd.drawFilledRectangle(gpsX, gpsY + crSm, gpsW, gpsH - 2 * crSm, widget.C_CARD)
    lcd.drawFilledRectangle(gpsX + crSm, gpsY, gpsW - 2 * crSm, gpsH, widget.C_CARD)
    lcd.drawFilledCircle(gpsX + crSm, gpsY + crSm, crSm, widget.C_CARD)
    lcd.drawFilledCircle(gpsX + gpsW - crSm, gpsY + crSm, crSm, widget.C_CARD)
    lcd.drawFilledCircle(gpsX + crSm, gpsY + gpsH - crSm, crSm, widget.C_CARD)
    lcd.drawFilledCircle(gpsX + gpsW - crSm, gpsY + gpsH - crSm, crSm, widget.C_CARD)

    local yGps = gpsY + 6
    local yGpsVal = yGps + LH.SML + LH.GAP
    local yGpsUnit = yGpsVal + LH.MID + LH.GAP

    lcd.drawText(gpsX + 12, yGps, "ALT", SMLSIZE + LIGHTGREY)
    lcd.drawText(gpsX + 12, yGpsVal, altStr, MIDSIZE + WHITE)
    lcd.drawText(gpsX + 12, yGpsUnit, "m", SMLSIZE + LIGHTGREY)

    lcd.drawText(gpsX + 168, yGps, "SPD", SMLSIZE + LIGHTGREY)
    lcd.drawText(gpsX + 168, yGpsVal, gspdStr, MIDSIZE + WHITE)
    lcd.drawText(gpsX + 168, yGpsUnit, "km/h", SMLSIZE + LIGHTGREY)

    lcd.drawText(gpsX + 324, yGps, "SATS", SMLSIZE + LIGHTGREY)
    lcd.drawText(gpsX + 324, yGpsVal, satsStr, MIDSIZE + CYAN)
  end

  lcd.drawFilledRectangle(0, h - footerH, w, footerH, widget.C_CARD)
  lcd.drawFilledRectangle(pad, h - footerH, w - pad * 2, 2, MAGENTA)

  local statusLabel = "DISARMED"
  local statusColor = GREY
  if armed then
    statusLabel = "ARMED"
    statusColor = ORANGE
  end

  lcd.drawFilledRectangle(pad, h - footerH + 6, 72, 16, DARKGREY)
  local footerTextY = h - footerH + math.floor((footerH - LH.SML) / 2)
  lcd.drawText(pad + 36, footerTextY, statusLabel, SMLSIZE + CENTER + statusColor)

  lcd.drawText(pad + 84, footerTextY, "TRSS " .. trssStr, SMLSIZE + GREY)
  lcd.drawText(w - pad, footerTextY, fmStr, SMLSIZE + RIGHT + ORANGE)
end

return {
  name = name,
  options = options,
  create = create,
  update = update,
  refresh = refresh,
}
