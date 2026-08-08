---@type WidgetScript
---@simulate Layout1x1 zone=0
-- BfDash8f — Tiny Whoop quad overview (light surface, voltage hero)
-- Layout: reserved rects + cross-region overlap check — tx15-text-layout.md

local name = "BfDash8f"

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

local function rect(x, y, w, h)
  return { x = x, y = y, w = w, h = h }
end

local function rectBottom(r)
  return r.y + r.h
end

local function rectRight(r)
  return r.x + r.w
end

local function rectsOverlap(a, b)
  return a.x < rectRight(b) and rectRight(a) > b.x and a.y < rectBottom(b) and rectBottom(a) > b.y
end

local function gaugeHitsObstacle(rGauge, obstacles)
  for i = 1, #obstacles do
    if rectsOverlap(rGauge, obstacles[i]) then
      return true
    end
  end
  return false
end

local function textRowRect(x, y, w, lineH)
  return rect(x, y, w, lineH)
end

local function anyTextForeignOverlap(textEntries, shapeRects)
  for ti = 1, #textEntries do
    local entry = textEntries[ti]
    for si = 1, #shapeRects do
      local shape = shapeRects[si]
      if shape ~= entry.owner and rectsOverlap(entry.rect, shape) then
        return true
      end
    end
    for tj = ti + 1, #textEntries do
      local other = textEntries[tj]
      if other.owner ~= entry.owner and rectsOverlap(entry.rect, other.rect) then
        return true
      end
    end
  end
  return false
end

local function barsPctRowH()
  return LH.SML
end

local function satelliteBelowH()
  return 6 + LH.SML + LH.GAP + LH.MID + LH.GAP + LH.SML
end

local function gaugeZoneH(rOut)
  return rOut * 2 + satelliteBelowH()
end

local function stripInnerRowH()
  return LH.SML + LH.GAP + LH.MID
end

local function stripBlockH(showAtt, showCapa)
  if not showAtt and not showCapa then
    return 0
  end
  local pad = 8
  if showAtt and showCapa then
    return pad + stripInnerRowH() * 2 + LH.GAP + pad
  end
  return pad + stripInnerRowH() + pad
end

local options = {
  { "ShowTimer", BOOL, 1 },
  { "ShowAtt", BOOL, 1 },
  { "ShowCapa", BOOL, 1 },
  { "ShowLink", BOOL, 1 },
  { "ShowGPS", BOOL, 0 },
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

local function fmtTimer(secs)
  if secs <= 0 then return "00:00" end
  local m = math.floor(secs / 60)
  local s = secs % 60
  return string.format("%02d:%02d", m, s)
end

local function create(zone, opts)
  return {
    zone = zone,
    options = opts,
    armed = false,
    flightSecs = 0,
    lastFlightSecs = 0,
    C_BG = lcd.RGB(220, 224, 232),
    C_CARD = lcd.RGB(255, 255, 255),
    C_TEXT = lcd.RGB(24, 28, 36),
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
end

local function background(widget)
  if widget.armed then
    widget.flightSecs = (widget.flightSecs or 0) + 1
  end
end

local function refresh(widget, event, touchState)
  local w = LCD_W
  local h = LCD_H
  local pad = 12
  local headerH = 40
  local footerH = 28
  local armBannerH = 28
  local C_BG = widget.C_BG
  local C_CARD = widget.C_CARD

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

  local fmStr = "DISARM"
  local armed = false
  if type(fm) == "string" and fm ~= "" then
    fmStr = fm
    local upper = string.upper(fm)
    if string.find(upper, "ARM") and not string.find(upper, "DISARM") then
      armed = true
    end
  end

  if armed and not widget.armed then
    widget.flightSecs = 0
  elseif not armed and widget.armed then
    widget.lastFlightSecs = widget.flightSecs or 0
    widget.flightSecs = 0
  end
  widget.armed = armed

  local batPctVal = batpct
  if batPctVal <= 0 and volts > 0 then
    batPctVal = math.max(0, math.min(100, (volts - 3.0) / (4.2 - 3.0) * 100))
  end
  batPctVal = math.max(0, math.min(100, batPctVal))

  local rqlyPct = math.max(0, math.min(100, rqly))
  local linkFillPct = math.floor(rqlyPct + 0.5)
  local battFillPct = math.floor(batPctVal + 0.5)

  local voltsStr = "--"
  if volts > 0 then
    voltsStr = string.format("%.2f", volts)
  end

  local ampsStr = "--"
  if amps > 0 then
    ampsStr = string.format("%.1f", amps)
  end

  local capaStr = "--"
  if capa > 0 then
    capaStr = tostring(math.floor(capa + 0.5))
  end

  local trssStr = "--"
  if trss ~= 0 then
    trssStr = tostring(math.floor(trss + 0.5))
  end

  local batPctStr = "--"
  if batPctVal > 0 then
    batPctStr = tostring(battFillPct) .. "%"
  end

  local altStr = "--"
  if alt ~= 0 then
    altStr = tostring(math.floor(alt + 0.5))
  end

  local gspdStr = "--"
  if gspd > 0 then
    gspdStr = tostring(math.floor(gspd + 0.5))
  end

  local satsStr = "--"
  if sats > 0 then
    satsStr = tostring(sats)
  end

  local rollDeg = attDeg(roll)
  local ptchDeg = attDeg(ptch)
  local rollStr = "--"
  local ptchStr = "--"
  if rollDeg then rollStr = tostring(rollDeg) end
  if ptchDeg then ptchStr = tostring(ptchDeg) end

  local displaySecs = widget.flightSecs or 0
  if not armed and (widget.lastFlightSecs or 0) > 0 then
    displaySecs = widget.lastFlightSecs
  end
  local timerStr = fmtTimer(displaySecs)
  local timerLabel = "FLIGHT"
  if not armed and displaySecs == 0 then
    timerLabel = "READY"
  elseif not armed then
    timerLabel = "LAST"
  end

  local statusLabel = "DISARMED"
  local statusColor = GREY
  local bannerFill = C_CARD
  if armed then
    statusLabel = "ARMED  WHOOP MODE"
    statusColor = BLACK
    bannerFill = ORANGE
  end

  local showTimer = widget.options.ShowTimer == 1
  local showAtt = widget.options.ShowAtt == 1
  local showCapa = widget.options.ShowCapa == 1
  local showLink = widget.options.ShowLink == 1
  local showGPS = widget.options.ShowGPS == 1

  local contentBottom = h - footerH - pad

  -- === layout plan: fixed rects top-down + bottom-up, then gauge fits remainder ===
  local rHeader = rect(0, 0, w, headerH)
  local rArm = rect(0, headerH, w, armBannerH)

  local timerH = 0
  if showTimer then
    timerH = LH.DBL + LH.GAP + 8
  end
  local rTimer = rect(0, rectBottom(rArm) + pad, w, timerH)

  local barH = 14
  local barW = math.floor((w - pad * 3) / 2)
  local leftBarX = pad
  local rightBarX = pad * 2 + barW
  local barInset = 2

  local barsY = rectBottom(rTimer)
  if timerH == 0 then
    barsY = rectBottom(rArm) + pad
  end

  local barsBlockH = 0
  local trackY = barsY
  local barsPctY = barsY
  if showLink then
    trackY = barsY + LH.SML + LH.GAP
    barsPctY = trackY + barH + LH.GAP
    barsBlockH = barsPctY + barsPctRowH() - barsY
  end
  local rBars = rect(0, barsY, w, barsBlockH)
  local rBarsPctLeft = textRowRect(leftBarX, barsPctY, barW, barsPctRowH())
  local rBarsPctRight = textRowRect(rightBarX, barsPctY, barW, barsPctRowH())

  local gpsH = 0
  if showGPS then
    gpsH = LH.SML + LH.GAP + LH.MID + LH.GAP + LH.SML + pad
  end
  local gpsY = contentBottom - gpsH
  local rGps = rect(pad, gpsY, w - pad * 2, gpsH)

  local stripH = stripBlockH(showAtt, showCapa)
  local stripW = math.floor((w - pad * 3) / 2)
  local stripY = contentBottom - stripH
  if showGPS then
    stripY = gpsY - pad - stripH
  end
  local rStripLeft = rect(pad, stripY, stripW, stripH)
  local rStripRight = rect(pad * 2 + stripW, stripY, stripW, stripH)
  local rStripFull = rect(pad, stripY, w - pad * 2, stripH)

  local footerY = h - footerH
  local rFooter = rect(0, footerY, w, footerH)

  local mainTop = rectBottom(rBars) + pad
  local mainBottom = contentBottom
  if stripH > 0 then
    mainBottom = stripY - pad
  elseif showGPS then
    mainBottom = gpsY - pad
  end
  local mainH = mainBottom - mainTop

  local rOut = 52
  local rIn = 40
  while gaugeZoneH(rOut) > mainH and rOut > 24 do
    rOut = rOut - 4
    rIn = math.max(18, math.floor(rOut * 0.77))
  end

  local gaugeCx = math.floor(w / 2)
  local gaugeCy = mainTop + math.floor(mainH / 2)
  local gaugeTop = gaugeCy - rOut
  local gaugeSatBottom = gaugeCy + rOut + satelliteBelowH()
  local rGauge = rect(gaugeCx - rOut, gaugeTop, rOut * 2, gaugeSatBottom - gaugeTop)

  if stripH > 0 and rectBottom(rGauge) + pad > stripY then
    gaugeCy = stripY - pad - math.floor(satelliteBelowH() + rOut)
    if gaugeCy - rOut < mainTop then
      gaugeCy = mainTop + rOut
      while gaugeZoneH(rOut) > mainH and rOut > 20 do
        rOut = rOut - 2
        rIn = math.max(16, math.floor(rOut * 0.77))
      end
      gaugeCy = mainTop + rOut + math.floor((mainH - gaugeZoneH(rOut)) / 2)
    end
    gaugeTop = gaugeCy - rOut
    gaugeSatBottom = gaugeCy + rOut + satelliteBelowH()
    rGauge = rect(gaugeCx - rOut, gaugeTop, rOut * 2, gaugeSatBottom - gaugeTop)
  end

  local layoutRects = { rHeader, rArm, rFooter }
  local gaugeObstacles = {}
  if barsBlockH > 0 then
    layoutRects[#layoutRects + 1] = rBars
    gaugeObstacles[#gaugeObstacles + 1] = rBars
  end
  if stripH > 0 then
    if showAtt and showCapa then
      layoutRects[#layoutRects + 1] = rStripLeft
      layoutRects[#layoutRects + 1] = rStripRight
      gaugeObstacles[#gaugeObstacles + 1] = rStripLeft
      gaugeObstacles[#gaugeObstacles + 1] = rStripRight
    elseif showAtt or showCapa then
      layoutRects[#layoutRects + 1] = rStripFull
      gaugeObstacles[#gaugeObstacles + 1] = rStripFull
    end
  end
  if gpsH > 0 then
    layoutRects[#layoutRects + 1] = rGps
    gaugeObstacles[#gaugeObstacles + 1] = rGps
  end
  gaugeObstacles[#gaugeObstacles + 1] = rFooter
  layoutRects[#layoutRects + 1] = rGauge

  while rOut > 20 and gaugeHitsObstacle(rGauge, gaugeObstacles) do
    rOut = rOut - 2
    rIn = math.max(16, math.floor(rOut * 0.77))
    gaugeCy = mainTop + rOut + math.floor((mainH - gaugeZoneH(rOut)) / 2)
    if stripH > 0 and gaugeCy + rOut + satelliteBelowH() + pad > stripY then
      gaugeCy = stripY - pad - rOut - satelliteBelowH()
    end
    gaugeTop = gaugeCy - rOut
    gaugeSatBottom = gaugeCy + rOut + satelliteBelowH()
    rGauge = rect(gaugeCx - rOut, gaugeTop, rOut * 2, gaugeSatBottom - gaugeTop)
    layoutRects[#layoutRects] = rGauge
  end

  if timerH > 0 then
    layoutRects[#layoutRects + 1] = rTimer
  end

  local gaugeBlockH = LH.DBL + LH.GAP + LH.SML
  local yVolt = gaugeCy - math.floor(gaugeBlockH / 2)
  local yVUnit = yVolt + LH.DBL + LH.GAP
  local yAmpLbl = gaugeCy + rOut + 6
  local yAmpVal = yAmpLbl + LH.SML + LH.GAP
  local yAmpUnit = yAmpVal + LH.MID + LH.GAP
  local rGaugeInner = textRowRect(gaugeCx - 48, yVolt, 96, gaugeBlockH)
  local rGaugeSatLeft = textRowRect(gaugeCx - 80, yAmpVal, 72, LH.MID + LH.GAP + LH.SML)
  local rGaugeSatRight = textRowRect(gaugeCx + 8, yAmpVal, 72, LH.MID + LH.GAP + LH.SML)

  local textFootprintRects = {}
  if showLink then
    textFootprintRects[#textFootprintRects + 1] = { rect = rBarsPctLeft, owner = rBars }
    textFootprintRects[#textFootprintRects + 1] = { rect = rBarsPctRight, owner = rBars }
  end
  textFootprintRects[#textFootprintRects + 1] = { rect = rGaugeInner, owner = rGauge }
  textFootprintRects[#textFootprintRects + 1] = { rect = rGaugeSatLeft, owner = rGauge }
  textFootprintRects[#textFootprintRects + 1] = { rect = rGaugeSatRight, owner = rGauge }

  local layoutAllRects = {}
  for i = 1, #layoutRects do
    layoutAllRects[#layoutAllRects + 1] = layoutRects[i]
  end
  for i = 1, #textFootprintRects do
    layoutAllRects[#layoutAllRects + 1] = textFootprintRects[i].rect
  end

  if anyTextForeignOverlap(textFootprintRects, layoutRects) and rOut > 20 then
    rOut = rOut - 2
    rIn = math.max(16, math.floor(rOut * 0.77))
    gaugeCy = mainTop + rOut + math.floor((mainH - gaugeZoneH(rOut)) / 2)
    gaugeTop = gaugeCy - rOut
    gaugeSatBottom = gaugeCy + rOut + satelliteBelowH()
    rGauge = rect(gaugeCx - rOut, gaugeTop, rOut * 2, gaugeSatBottom - gaugeTop)
    layoutRects[#layoutRects] = rGauge
    yVolt = gaugeCy - math.floor(gaugeBlockH / 2)
    yVUnit = yVolt + LH.DBL + LH.GAP
    yAmpLbl = gaugeCy + rOut + 6
    yAmpVal = yAmpLbl + LH.SML + LH.GAP
    yAmpUnit = yAmpVal + LH.MID + LH.GAP
    rGaugeInner = textRowRect(gaugeCx - 48, yVolt, 96, gaugeBlockH)
    rGaugeSatLeft = textRowRect(gaugeCx - 80, yAmpVal, 72, LH.MID + LH.GAP + LH.SML)
    rGaugeSatRight = textRowRect(gaugeCx + 8, yAmpVal, 72, LH.MID + LH.GAP + LH.SML)
    textFootprintRects = {}
    if showLink then
      textFootprintRects[#textFootprintRects + 1] = { rect = rBarsPctLeft, owner = rBars }
      textFootprintRects[#textFootprintRects + 1] = { rect = rBarsPctRight, owner = rBars }
    end
    textFootprintRects[#textFootprintRects + 1] = { rect = rGaugeInner, owner = rGauge }
    textFootprintRects[#textFootprintRects + 1] = { rect = rGaugeSatLeft, owner = rGauge }
    textFootprintRects[#textFootprintRects + 1] = { rect = rGaugeSatRight, owner = rGauge }
    layoutAllRects = {}
    for i = 1, #layoutRects do
      layoutAllRects[#layoutAllRects + 1] = layoutRects[i]
    end
    for i = 1, #textFootprintRects do
      layoutAllRects[#layoutAllRects + 1] = textFootprintRects[i].rect
    end
  end

  -- drawText audit (each call → named rect in layoutAllRects / textFootprintRects):
  -- header title/footer chip → rHeader/rFooter; status → rArm; timer → rTimer
  -- bars labels + % → rBars / rBarsPctLeft|rBarsPctRight; gauge → rGaugeInner|rGaugeSat*

  local startA = 135
  local span = 270
  local trackEndA = startA + span
  local valA = startA + span * (batPctVal / 100)

  local chipW = 68
  local chipX = pad
  local chipLabel = armed and "ARMED" or "WHOOP"
  local trssText = "TRSS " .. trssStr
  local trssX = chipX + chipW + LH.GAP * 2
  local fmDisplay = truncStr(fmStr, 10)
  local fmRight = w - pad
  local fmLeft = fmRight - estW(fmDisplay, "SML")
  if trssX + estW(trssText, "SML") + LH.GAP * 2 > fmLeft then
    local maxTrss = math.floor((fmLeft - trssX - LH.GAP * 2) / CW.SML)
    if maxTrss < 4 then maxTrss = 4 end
    trssText = truncStr(trssText, maxTrss)
  end

  -- === phase 1: backgrounds (no text) ===
  lcd.clear(C_BG)

  lcd.drawFilledRectangle(rHeader.x, rHeader.y, rHeader.w, rHeader.h, WHITE)
  lcd.drawLine(0, headerH - 1, w, headerH - 1, SOLID, GREY)

  lcd.drawFilledRectangle(rArm.x, rArm.y, rArm.w, rArm.h, bannerFill)

  if showLink then
    lcd.drawFilledRectangle(leftBarX, trackY, barW, barH, GREY)
    lcd.drawFilledRectangle(rightBarX, trackY, barW, barH, GREY)

    local linkFillW = math.floor((barW - barInset * 2) * linkFillPct / 100)
    if linkFillW > 0 then
      lcd.drawFilledRectangle(leftBarX + barInset, trackY + barInset, linkFillW, barH - barInset * 2, DARKGREEN)
    end

    local battFillW = math.floor((barW - barInset * 2) * battFillPct / 100)
    local battColor = YELLOW
    if battFillPct <= 20 then
      battColor = DARKRED
    elseif battFillPct <= 40 then
      battColor = ORANGE
    end
    if battFillW > 0 then
      lcd.drawFilledRectangle(rightBarX + barInset, trackY + barInset, battFillW, barH - barInset * 2, battColor)
    end
  end

  if trackEndA > 360 then
    lcd.drawAnnulus(gaugeCx, gaugeCy, rIn, rOut, startA, 360, GREY)
    lcd.drawAnnulus(gaugeCx, gaugeCy, rIn, rOut, 0, trackEndA - 360, GREY)
  else
    lcd.drawAnnulus(gaugeCx, gaugeCy, rIn, rOut, startA, trackEndA, GREY)
  end

  local fillColor = YELLOW
  if battFillPct <= 20 then
    fillColor = DARKRED
  elseif battFillPct <= 40 then
    fillColor = ORANGE
  end

  if valA > 360 then
    lcd.drawAnnulus(gaugeCx, gaugeCy, rIn, rOut, startA, 360, fillColor)
    lcd.drawAnnulus(gaugeCx, gaugeCy, rIn, rOut, 0, valA - 360, fillColor)
  elseif batPctVal > 0 then
    lcd.drawAnnulus(gaugeCx, gaugeCy, rIn, rOut, startA, valA, fillColor)
  end

  local discR = rIn - 4
  if discR < math.floor(gaugeBlockH / 2) + 2 then
    discR = math.floor(gaugeBlockH / 2) + 2
  end
  lcd.drawFilledCircle(gaugeCx, gaugeCy, discR, C_CARD)

  if stripH > 0 then
    if showAtt and showCapa then
      lcd.drawFilledRectangle(rStripLeft.x, rStripLeft.y, rStripLeft.w, rStripLeft.h, C_CARD)
      lcd.drawRectangle(rStripLeft.x, rStripLeft.y, rStripLeft.w, rStripLeft.h, GREY)
      lcd.drawFilledRectangle(rStripRight.x, rStripRight.y, rStripRight.w, rStripRight.h, C_CARD)
      lcd.drawRectangle(rStripRight.x, rStripRight.y, rStripRight.w, rStripRight.h, GREY)
    else
      lcd.drawFilledRectangle(rStripFull.x, rStripFull.y, rStripFull.w, rStripFull.h, C_CARD)
      lcd.drawRectangle(rStripFull.x, rStripFull.y, rStripFull.w, rStripFull.h, GREY)
    end
  end

  if showGPS then
    lcd.drawFilledRectangle(rGps.x, rGps.y, rGps.w, rGps.h, C_CARD)
    lcd.drawRectangle(rGps.x, rGps.y, rGps.w, rGps.h, GREY)
  end

  lcd.drawFilledRectangle(rFooter.x, rFooter.y, rFooter.w, rFooter.h, GREY)
  lcd.drawFilledRectangle(chipX, footerY + 4, chipW, footerH - 8, armed and ORANGE or WHITE)

  -- === phase 2: text ===
  lcd.drawText(pad, 12, "WHOOP", MIDSIZE + DARKBLUE)
  lcd.drawText(w - pad, 12, "1S WHOOP", SMLSIZE + RIGHT + BLACK)

  lcd.drawText(w / 2, rArm.y + 6, statusLabel, MIDSIZE + CENTER + statusColor)

  if showTimer then
    lcd.drawText(pad, rTimer.y, timerLabel, SMLSIZE + BLACK)
    lcd.drawText(w / 2, rTimer.y, timerStr, DBLSIZE + CENTER + DARKBLUE)
  end

  if showLink then
    lcd.drawText(leftBarX, barsY, "LINK", SMLSIZE + BLACK)
    lcd.drawText(rightBarX, barsY, "BATTERY", SMLSIZE + BLACK)
    lcd.drawText(leftBarX + barW - 4, barsPctY, linkFillPct .. "%", SMLSIZE + RIGHT + DARKGREEN)
    lcd.drawText(rightBarX + barW - 4, barsPctY, batPctStr, SMLSIZE + RIGHT + ORANGE)
  end

  lcd.drawText(gaugeCx, yVolt, voltsStr, DBLSIZE + CENTER + DARKBLUE)
  lcd.drawText(gaugeCx, yVUnit, "VOLTS", SMLSIZE + CENTER + BLACK)
  lcd.drawText(gaugeCx - 56, yAmpVal, ampsStr, MIDSIZE + RIGHT + ORANGE)
  lcd.drawText(gaugeCx - 56, yAmpUnit, "A", SMLSIZE + RIGHT + BLACK)
  lcd.drawText(gaugeCx + 56, yAmpVal, batPctStr, MIDSIZE + LEFT + YELLOW)
  lcd.drawText(gaugeCx + 56, yAmpUnit, "LEFT", SMLSIZE + LEFT + BLACK)

  if stripH > 0 then
    local sy = stripY + 8
    if showAtt and showCapa then
      lcd.drawText(rStripLeft.x + 10, sy, "PITCH", SMLSIZE + BLACK)
      lcd.drawText(rStripLeft.x + 10, sy + LH.SML + LH.GAP, ptchStr, MIDSIZE + DARKBLUE)
      lcd.drawText(rStripLeft.x + 10, sy + stripInnerRowH() + LH.GAP, "ROLL", SMLSIZE + BLACK)
      lcd.drawText(rStripLeft.x + 10, sy + stripInnerRowH() + LH.GAP + LH.SML + LH.GAP, rollStr, MIDSIZE + DARKBLUE)
      lcd.drawText(rStripRight.x + 10, sy, "USED", SMLSIZE + BLACK)
      lcd.drawText(rStripRight.x + 10, sy + LH.SML + LH.GAP, capaStr, MIDSIZE + ORANGE)
      lcd.drawText(rStripRight.x + 10, sy + LH.SML + LH.GAP + LH.MID + LH.GAP, "mAh", SMLSIZE + BLACK)
    elseif showAtt then
      local halfW = math.floor(rStripFull.w / 2)
      lcd.drawText(rStripFull.x + 10, sy, "PITCH", SMLSIZE + BLACK)
      lcd.drawText(rStripFull.x + 10, sy + LH.SML + LH.GAP, ptchStr, MIDSIZE + DARKBLUE)
      lcd.drawText(rStripFull.x + halfW + 10, sy, "ROLL", SMLSIZE + BLACK)
      lcd.drawText(rStripFull.x + halfW + 10, sy + LH.SML + LH.GAP, rollStr, MIDSIZE + DARKBLUE)
    elseif showCapa then
      lcd.drawText(rStripFull.x + 10, sy, "USED", SMLSIZE + BLACK)
      lcd.drawText(rStripFull.x + 10, sy + LH.SML + LH.GAP, capaStr, MIDSIZE + ORANGE)
      lcd.drawText(rStripFull.x + 10, sy + LH.SML + LH.GAP + LH.MID + LH.GAP, "mAh", SMLSIZE + BLACK)
    end
  end

  if showGPS then
    local gy = gpsY + 8
    lcd.drawText(pad + 10, gy, "ALT", SMLSIZE + BLACK)
    lcd.drawText(pad + 10, gy + LH.SML + LH.GAP, altStr, MIDSIZE + DARKBLUE)
    lcd.drawText(pad + 120, gy, "SPD", SMLSIZE + BLACK)
    lcd.drawText(pad + 120, gy + LH.SML + LH.GAP, gspdStr, MIDSIZE + DARKBLUE)
    lcd.drawText(w - pad - 10, gy, "SATS", SMLSIZE + RIGHT + BLACK)
    lcd.drawText(w - pad - 10, gy + LH.SML + LH.GAP, satsStr, MIDSIZE + RIGHT + DARKGREEN)
  end

  lcd.drawText(chipX + math.floor(chipW / 2), footerY + 8, chipLabel, SMLSIZE + CENTER + BLACK)
  lcd.drawText(trssX, footerY + 8, trssText, SMLSIZE + BLACK)
  lcd.drawText(fmRight, footerY + 8, fmDisplay, SMLSIZE + RIGHT + DARKBLUE)
end

return {
  name = name,
  options = options,
  create = create,
  update = update,
  background = background,
  refresh = refresh,
}
