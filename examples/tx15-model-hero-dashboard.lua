---@type WidgetScript
---@simulate Layout1x1 zone=0
-- TX15 model-background + rotary battery gauge (quad / tinywhoop overview)
-- Gold standard for model-hero layouts — see knowledge/design/model-hero-dashboard.md

local name = "TXModelHr"

-- TX15 lcd.drawText line heights (px) — knowledge/design/tx15-text-layout.md
local LH = { SML = 12, MID = 18, DBL = 26, GAP = 4, SEC = 8 }
local CW = { SML = 6, MID = 9, DBL = 12 }

local function estW(str, sizeKey)
  return string.len(str) * CW[sizeKey]
end

local function truncStr(str, maxChars)
  if string.len(str) <= maxChars then
    return str
  end
  if maxChars < 2 then
    return string.sub(str, 1, maxChars)
  end
  return string.sub(str, 1, maxChars - 1) .. "."
end

local function fieldStackH(valH, gap, sec)
  return LH.SML + gap + valH + gap + LH.SML + sec
end

local function cardContentH(valH, gap, sec)
  return fieldStackH(valH, gap, sec) + fieldStackH(valH, gap, 0) - sec
end

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
  local heroW = math.floor(w * 0.52)

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

  -- === layout plan: cascade Y from optional blocks (worst case = all sections on) ===
  local topBarH = 30
  local topBarY = contentTop
  local barsBottom = topBarY + topBarH

  local gpsValH = LH.MID
  local gpsGap = LH.GAP
  local gpsH = 0
  if widget.options.ShowGPS == 1 then
    gpsH = LH.SML + gpsGap + gpsValH + gpsGap + LH.SML + 12
  end
  local gpsY = contentBottom - gpsH

  local mainTop = barsBottom + pad
  local mainBottom = contentBottom
  if gpsH > 0 then
    mainBottom = gpsY - pad
  end
  local mainH = mainBottom - mainTop

  local cardX = heroW + pad
  local cardW = w - cardX - pad
  local cardY = mainTop
  local cardH = mainH
  local cardPad = 10
  local cardInnerH = cardH - cardPad * 2

  local stackGap = LH.GAP
  local stackSec = LH.SEC
  local cardValH = LH.MID
  local cardValFlags = MIDSIZE
  local showAtt = widget.options.ShowAtt == 1

  while cardContentH(cardValH, stackGap, stackSec) > cardInnerH and stackSec > 4 do
    stackSec = stackSec - 2
  end
  if cardContentH(cardValH, stackGap, stackSec) > cardInnerH then
    cardValH = LH.SML
    cardValFlags = SMLSIZE
    stackSec = 4
  end
  if cardContentH(cardValH, stackGap, stackSec) > cardInnerH then
    showAtt = false
    stackGap = 2
  end

  local y = cardY + cardPad
  local yPowerLbl = y
  y = y + LH.SML + stackGap
  local yPowerVal = y
  y = y + cardValH + stackGap
  local yPowerUnit = y
  y = y + LH.SML + stackSec
  local yUsedLbl = y
  y = y + LH.SML + stackGap
  local yUsedVal = y
  y = y + cardValH + stackGap
  local yUsedUnit = y

  local valX = cardX + 12
  local attX = cardX + cardW - 12
  local colGap = LH.GAP * 2
  local midX = math.floor((valX + attX) / 2)
  local leftMaxChars = math.floor((midX - colGap - valX) / CW.MID)
  if leftMaxChars < 3 then
    leftMaxChars = 3
  end
  ampsStr = truncStr(ampsStr, leftMaxChars)
  capaStr = truncStr(capaStr, leftMaxChars)

  local rOut = 56
  local rIn = 42
  local maxGaugeR = math.floor((mainH - 8) / 2)
  if rOut > maxGaugeR then
    rOut = math.max(24, maxGaugeR)
    rIn = math.max(16, math.floor(rOut * 0.75))
  end
  local gaugeCx = math.floor(heroW / 2)
  local gaugeCy = mainTop + math.floor(mainH / 2)
  if gaugeCy - rOut < mainTop + 2 then
    gaugeCy = mainTop + rOut + 2
  elseif gaugeCy + rOut > mainTop + mainH - 2 then
    gaugeCy = mainTop + mainH - rOut - 2
  end

  local gaugeBlockH = LH.DBL + LH.GAP + LH.SML
  local gaugeDiscR = rIn - 4
  if gaugeDiscR < math.floor(gaugeBlockH / 2) + 2 then
    gaugeDiscR = math.floor(gaugeBlockH / 2) + 2
  end

  local startA = 135
  local span = 270
  local trackEndA = startA + span
  local valA = startA + span * (batPctVal / 100)

  local barW = math.floor((w - pad * 3) / 2)
  local leftBarX = pad
  local rightBarX = pad * 2 + barW
  local barInset = 4

  local statusLabel = "DISARM"
  local statusColor = GREY
  if armed then
    statusLabel = "ARMED"
    statusColor = ORANGE
  end

  local chipW = 72
  local chipX = pad
  local footerRowGap = LH.GAP * 2
  local trssText = "TRSS " .. trssStr
  local trssX = chipX + chipW + footerRowGap
  local fmDisplay = truncStr(fmStr, 10)
  local fmRight = w - pad
  local fmLeft = fmRight - estW(fmDisplay, "SML")
  local trssEnd = trssX + estW(trssText, "SML")
  if trssEnd + footerRowGap > fmLeft then
    local maxTrssW = fmLeft - footerRowGap - trssX
    local maxTrssChars = math.floor(maxTrssW / CW.SML)
    if maxTrssChars < 4 then
      maxTrssChars = 4
    end
    trssText = truncStr(trssText, maxTrssChars)
    trssEnd = trssX + estW(trssText, "SML")
    local fmMaxW = fmLeft - footerRowGap - trssEnd
    local maxFmChars = math.floor(fmMaxW / CW.SML)
    if maxFmChars < 3 then
      maxFmChars = 3
    end
    fmDisplay = truncStr(fmDisplay, maxFmChars)
  end

  local titleText = "TINYWHOOP"
  local subText = "BF CRSF"
  if estW(titleText, "MID") + footerRowGap > w - pad - estW(subText, "SML") then
    titleText = truncStr(titleText, math.floor((w - pad * 2 - estW(subText, "SML") - footerRowGap) / CW.MID))
  end

  -- === phase 1: backgrounds and decorative fills (no text) ===
  lcd.clear(BLACK)

  if widget.options.ShowModel == 1 then
    if widget.bmpW > 0 and widget.bmpH > 0 then
      local scaleX = math.floor(w * 100 / widget.bmpW)
      local scaleY = math.floor(mainH * 100 / widget.bmpH)
      local bmpScale = scaleX
      if scaleY > bmpScale then
        bmpScale = scaleY
      end
      local drawW = math.floor(widget.bmpW * bmpScale / 100)
      local drawH = math.floor(widget.bmpH * bmpScale / 100)
      local imgX = math.floor((w - drawW) / 2)
      local imgY = math.floor(mainTop + (mainH - drawH) / 2)
      lcd.drawBitmap(widget.modelBmp, imgX, imgY, bmpScale)
    else
      lcd.drawFilledRectangle(pad, mainTop + pad, w - pad * 2, mainH - pad * 2, DARKGREY)
    end
    lcd.drawFilledRectangle(0, mainTop, w, mainH, BLACK, widget.BG_DIM)
  end

  lcd.drawFilledRectangle(0, 0, w, headerH, widget.C_CARD)
  lcd.drawFilledRectangle(pad, headerH - 2, w - pad * 2, 2, MAGENTA)

  if widget.options.ShowLink == 1 then
    lcd.drawFilledRectangle(leftBarX, topBarY + crSm, barW, topBarH - 2 * crSm, widget.C_CARD)
    lcd.drawFilledRectangle(leftBarX + crSm, topBarY, barW - 2 * crSm, topBarH, widget.C_CARD)
    lcd.drawFilledCircle(leftBarX + crSm, topBarY + crSm, crSm, widget.C_CARD)
    lcd.drawFilledCircle(leftBarX + barW - crSm, topBarY + crSm, crSm, widget.C_CARD)
    lcd.drawFilledCircle(leftBarX + crSm, topBarY + topBarH - crSm, crSm, widget.C_CARD)
    lcd.drawFilledCircle(leftBarX + barW - crSm, topBarY + topBarH - crSm, crSm, widget.C_CARD)
  end

  lcd.drawFilledRectangle(rightBarX, topBarY + crSm, barW, topBarH - 2 * crSm, widget.C_CARD)
  lcd.drawFilledRectangle(rightBarX + crSm, topBarY, barW - 2 * crSm, topBarH, widget.C_CARD)
  lcd.drawFilledCircle(rightBarX + crSm, topBarY + crSm, crSm, widget.C_CARD)
  lcd.drawFilledCircle(rightBarX + barW - crSm, topBarY + crSm, crSm, widget.C_CARD)
  lcd.drawFilledCircle(rightBarX + crSm, topBarY + topBarH - crSm, crSm, widget.C_CARD)
  lcd.drawFilledCircle(rightBarX + barW - crSm, topBarY + topBarH - crSm, crSm, widget.C_CARD)

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
  lcd.drawFilledCircle(gaugeCx, gaugeCy, gaugeDiscR, BLACK)

  lcd.drawFilledRectangle(cardX, cardY + cr, cardW, cardH - 2 * cr, widget.C_CARD)
  lcd.drawFilledRectangle(cardX + cr, cardY, cardW - 2 * cr, cardH, widget.C_CARD)
  lcd.drawFilledCircle(cardX + cr, cardY + cr, cr, widget.C_CARD)
  lcd.drawFilledCircle(cardX + cardW - cr, cardY + cr, cr, widget.C_CARD)
  lcd.drawFilledCircle(cardX + cr, cardY + cardH - cr, cr, widget.C_CARD)
  lcd.drawFilledCircle(cardX + cardW - cr, cardY + cardH - cr, cr, widget.C_CARD)
  lcd.drawFilledRectangle(cardX, cardY, cardW, 2, MAGENTA)

  if widget.options.ShowGPS == 1 then
    local gpsW = w - pad * 2
    local gpsX = pad
    lcd.drawFilledRectangle(gpsX, gpsY + crSm, gpsW, gpsH - 2 * crSm, widget.C_CARD)
    lcd.drawFilledRectangle(gpsX + crSm, gpsY, gpsW - 2 * crSm, gpsH, widget.C_CARD)
    lcd.drawFilledCircle(gpsX + crSm, gpsY + crSm, crSm, widget.C_CARD)
    lcd.drawFilledCircle(gpsX + gpsW - crSm, gpsY + crSm, crSm, widget.C_CARD)
    lcd.drawFilledCircle(gpsX + crSm, gpsY + gpsH - crSm, crSm, widget.C_CARD)
    lcd.drawFilledCircle(gpsX + gpsW - crSm, gpsY + gpsH - crSm, crSm, widget.C_CARD)
  end

  lcd.drawFilledRectangle(0, h - footerH, w, footerH, widget.C_CARD)
  lcd.drawFilledRectangle(pad, h - footerH, w - pad * 2, 2, MAGENTA)
  lcd.drawFilledRectangle(chipX, h - footerH + 6, chipW, 16, DARKGREY)

  if widget.options.ShowLink == 1 then
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

  local battTrackX = rightBarX + 8
  local battTrackY = topBarY + barInset + LH.SML + LH.GAP
  local battTrackW = barW - 16
  local battTrackH = 8
  lcd.drawFilledRectangle(battTrackX, battTrackY, battTrackW, battTrackH, GREY)
  local battFillW = math.floor(battTrackW * batPctVal / 100)
  if battFillW > 0 then
    lcd.drawFilledRectangle(battTrackX, battTrackY, battFillW, battTrackH, ORANGE)
  end

  -- === phase 2: all text (after backgrounds in each region) ===
  local titleY = math.floor((headerH - LH.MID) / 2)
  local subY = math.floor((headerH - LH.SML) / 2)
  lcd.drawText(pad, titleY, titleText, MIDSIZE + MAGENTA)
  lcd.drawText(w - pad, subY, subText, SMLSIZE + RIGHT + CYAN)

  if widget.options.ShowLink == 1 then
    lcd.drawText(leftBarX + 8, topBarY + barInset, "LINK", SMLSIZE + LIGHTGREY)
    lcd.drawText(leftBarX + barW - 8, topBarY + barInset, rqlyStr, SMLSIZE + RIGHT + CYAN)
  end

  lcd.drawText(rightBarX + 8, topBarY + barInset, "BATT", SMLSIZE + LIGHTGREY)
  lcd.drawText(rightBarX + barW - 8, topBarY + barInset, batPctStr, SMLSIZE + RIGHT + ORANGE)

  if widget.options.ShowModel == 1 and (widget.bmpW == 0 or widget.bmpH == 0) then
    lcd.drawText(math.floor(w / 2), mainTop + math.floor(mainH / 2) - 6, "MODEL", SMLSIZE + CENTER + GREY)
  end

  local yVolt = gaugeCy - math.floor(gaugeBlockH / 2)
  local yVUnit = yVolt + LH.DBL + LH.GAP
  lcd.drawText(gaugeCx, yVolt, voltsStr, DBLSIZE + CENTER + ORANGE)
  lcd.drawText(gaugeCx, yVUnit, "V", SMLSIZE + CENTER + LIGHTGREY)

  lcd.drawText(valX, yPowerLbl, "POWER", SMLSIZE + LIGHTGREY)
  lcd.drawText(valX, yPowerVal, ampsStr, cardValFlags + CYAN)
  lcd.drawText(valX, yPowerUnit, "A", SMLSIZE + LIGHTGREY)
  lcd.drawText(valX, yUsedLbl, "USED", SMLSIZE + LIGHTGREY)
  lcd.drawText(valX, yUsedVal, capaStr, cardValFlags + ORANGE)
  lcd.drawText(valX, yUsedUnit, "mAh", SMLSIZE + LIGHTGREY)

  if showAtt then
    lcd.drawText(attX, yPowerVal, rollStr, cardValFlags + RIGHT + WHITE)
    lcd.drawText(attX, yPowerUnit, "R", SMLSIZE + RIGHT + LIGHTGREY)
    lcd.drawText(attX, yUsedVal, ptchStr, cardValFlags + RIGHT + WHITE)
    lcd.drawText(attX, yUsedUnit, "P", SMLSIZE + RIGHT + LIGHTGREY)
  end

  if widget.options.ShowGPS == 1 then
    local gpsW = w - pad * 2
    local gpsX = pad
    local gpsPad = 6
    local yGps = gpsY + gpsPad
    local yGpsVal = yGps + LH.SML + gpsGap
    local yGpsUnit = yGpsVal + gpsValH + gpsGap
    local colW = math.floor(gpsW / 3)

    lcd.drawText(gpsX + 12, yGps, "ALT", SMLSIZE + LIGHTGREY)
    lcd.drawText(gpsX + 12, yGpsVal, altStr, MIDSIZE + WHITE)
    lcd.drawText(gpsX + 12, yGpsUnit, "m", SMLSIZE + LIGHTGREY)

    local spdX = gpsX + colW + 12
    lcd.drawText(spdX, yGps, "SPD", SMLSIZE + LIGHTGREY)
    lcd.drawText(spdX, yGpsVal, gspdStr, MIDSIZE + WHITE)
    lcd.drawText(spdX, yGpsUnit, "km/h", SMLSIZE + LIGHTGREY)

    local satsX = gpsX + colW * 2 + 12
    lcd.drawText(satsX, yGps, "SATS", SMLSIZE + LIGHTGREY)
    lcd.drawText(satsX, yGpsVal, satsStr, MIDSIZE + CYAN)
  end

  local footerTextY = h - footerH + math.floor((footerH - LH.SML) / 2)
  lcd.drawText(chipX + math.floor(chipW / 2), footerTextY, statusLabel, SMLSIZE + CENTER + statusColor)
  lcd.drawText(trssX, footerTextY, trssText, SMLSIZE + GREY)
  lcd.drawText(fmRight, footerTextY, fmDisplay, SMLSIZE + RIGHT + ORANGE)
end

return {
  name = name,
  options = options,
  create = create,
  update = update,
  refresh = refresh,
}
