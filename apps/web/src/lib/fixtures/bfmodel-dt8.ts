/** Golden fixture: BfModelDt8 strip-board widget (Betaflight, TX15). */
export const BFMODEL_DT8_SOURCE = `---@type WidgetScript
---@simulate Layout1x1 zone=0
local name = "BfModelDt8"

local MODEL_IMG = "/MODELS/model.png"

local options = {
  { "ShowModel", BOOL, 1 },
  { "ShowGPS", BOOL, 0 },
  { "ShowCapa", BOOL, 1 },
  { "ShowAlt", BOOL, 1 },
  { "ShowTimer", BOOL, 1 },
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
    modelBmp = Bitmap.open(MODEL_IMG),
    C_BG = lcd.RGB(255, 255, 255),
    C_CARD = lcd.RGB(255, 255, 255),
    C_TEXT = lcd.RGB(0, 0, 0),
    C_BORDER = lcd.RGB(200, 32, 32),
    C_HERO = lcd.RGB(0, 48, 120),
    C_TRACK = lcd.RGB(220, 224, 232),
    src = {
      rqly = cacheSource("RQLY"),
      trss = cacheSource("TRSS"),
      rxbt = cacheSource("RxBt"),
      batpct = cacheSource("Bat%"),
      curr = cacheSource("Curr"),
      capa = cacheSource("Capa"),
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
  local gutter = 8
  local headerH = 40
  local footerH = 28
  local contentTop = headerH + pad
  local contentBottom = h - footerH - pad
  local contentH = contentBottom - contentTop

  local C_BG = widget.C_BG
  local C_CARD = widget.C_CARD
  local C_TEXT = widget.C_TEXT
  local C_BORDER = widget.C_BORDER
  local C_HERO = widget.C_HERO
  local C_TRACK = widget.C_TRACK

  lcd.clear(C_BG)

  lcd.drawFilledRectangle(0, 0, w, headerH, C_CARD)
  lcd.drawRectangle(0, 0, w, headerH, C_BORDER)
  lcd.drawText(pad, 12, "WHOOP LIVE", MIDSIZE + BLACK)

  local modelBandH = 0
  if widget.options.ShowModel == 1 then modelBandH = 72 end

  local rowGap = gutter
  local stripRows = 2
  local stripRowH = math.floor((contentH - modelBandH - rowGap) / stripRows - rowGap / 2)
  if stripRowH < 56 then stripRowH = 56 end

  local stripCount = 4
  local totalGutter = gutter * (stripCount - 1)
  local stripW = math.floor((w - pad * 2 - totalGutter) / stripCount)

  local rqly = telem(widget.src.rqly)
  local trss = telem(widget.src.trss)
  local volts = telem(widget.src.rxbt)
  local batpct = telem(widget.src.batpct)
  local curr = telem(widget.src.curr)
  local capa = telem(widget.src.capa)
  local alt = telem(widget.src.alt)
  local gspd = telem(widget.src.gspd)
  local sats = telem(widget.src.sats)
  local fmRaw = telem(widget.src.fm)

  local rqlyPct = math.max(0, math.min(100, rqly))
  local batPctVal = batpct
  if batPctVal <= 0 and volts > 0 then
    batPctVal = math.max(0, math.min(100, (volts - 3.3) / (4.2 - 3.3) * 100))
  end
  batPctVal = math.max(0, math.min(100, batPctVal))

  local rqlyStr = "--"
  if rqly > 0 then rqlyStr = tostring(math.floor(rqlyPct + 0.5)) .. "%" end

  local trssStr = "--"
  if trss ~= 0 then trssStr = tostring(math.floor(trss + 0.5)) .. " dB" end

  local voltStr = "--"
  if volts > 0 then voltStr = string.format("%.1fV", volts) end

  local batPctStr = "--"
  if batpct > 0 or volts > 0 then batPctStr = tostring(math.floor(batPctVal + 0.5)) .. "%" end

  local currStr = "--"
  if curr ~= 0 then currStr = string.format("%.1fA", curr) end

  local capaStr = "--"
  if capa > 0 then capaStr = tostring(math.floor(capa + 0.5)) .. " mAh" end

  local altStr = "--"
  if alt ~= 0 then altStr = tostring(math.floor(alt + 0.5)) .. " m" end

  local gspdStr = "--"
  if gspd > 0 then gspdStr = tostring(math.floor(gspd + 0.5)) .. " km/h" end

  local satsStr = "--"
  if sats > 0 then satsStr = tostring(sats) end

  local fmStr = "--"
  if type(fmRaw) == "string" and fmRaw ~= "" then
    fmStr = fmRaw
  elseif fmRaw ~= 0 then
    fmStr = tostring(fmRaw)
  end

  local timerVal = 0
  local timerStr = "--"
  local tInfo = model.getTimer(0)
  if tInfo and tInfo.value then timerVal = tInfo.value end
  if timerVal > 0 then
    local mins = math.floor(timerVal / 60)
    local secs = timerVal % 60
    timerStr = string.format("%02d:%02d", mins, secs)
  end

  local armed = curr > 0.4
  local statusStr = "DISARMED"
  local statusColor = BLACK
  if armed then
    statusStr = "ARMED"
    statusColor = ORANGE
  end

  local yCursor = contentTop

  if widget.options.ShowModel == 1 then
    local imgW = 96
    local imgH = 64
    local imgX = pad
    local imgY = yCursor + 4
    lcd.drawFilledRectangle(imgX, yCursor, imgW, modelBandH, C_CARD)
    lcd.drawRectangle(imgX, yCursor, imgW, modelBandH, C_BORDER)
    lcd.drawBitmap(widget.modelBmp, imgX + 8, imgY)
    lcd.drawText(imgX + imgW / 2, yCursor + modelBandH - 14, "MODEL", SMLSIZE + CENTER + BLACK)

    local heroX = imgX + imgW + gutter
    local heroW = w - heroX - pad
    lcd.drawFilledRectangle(heroX, yCursor, heroW, modelBandH, C_CARD)
    lcd.drawRectangle(heroX, yCursor, heroW, modelBandH, C_BORDER)
    lcd.drawText(heroX + heroW / 2, yCursor + 8, "BATTERY", SMLSIZE + CENTER + BLACK)
    lcd.drawText(heroX + heroW / 2, yCursor + 26, voltStr, DBLSIZE + CENTER + C_HERO)
    lcd.drawText(heroX + heroW / 2, yCursor + 54, batPctStr, SMLSIZE + CENTER + BLACK)

    local heroBarW = heroW - 24
    local heroBarX = heroX + 12
    local heroBarY = yCursor + modelBandH - 12
    lcd.drawFilledRectangle(heroBarX, heroBarY, heroBarW, 6, C_TRACK)
    local heroFill = math.floor(heroBarW * batPctVal / 100)
    if heroFill > 0 then
      lcd.drawFilledRectangle(heroBarX, heroBarY, heroFill, 6, ORANGE)
    end
    lcd.drawRectangle(heroBarX, heroBarY, heroBarW, 6, C_BORDER)

    yCursor = yCursor + modelBandH + rowGap
  end

  local row1Y = yCursor
  local row2Y = row1Y + stripRowH + rowGap

  local s0x = pad
  local s1x = s0x + stripW + gutter
  local s2x = s1x + stripW + gutter
  local s3x = s2x + stripW + gutter

  lcd.drawFilledRectangle(s0x, row1Y, stripW, stripRowH, C_CARD)
  lcd.drawRectangle(s0x, row1Y, stripW, stripRowH, C_BORDER)
  lcd.drawText(s0x + stripW / 2, row1Y + 8, "VOLTAGE", SMLSIZE + CENTER + BLACK)
  lcd.drawText(s0x + stripW / 2, row1Y + 28, voltStr, MIDSIZE + CENTER + C_HERO)

  lcd.drawFilledRectangle(s1x, row1Y, stripW, stripRowH, C_CARD)
  lcd.drawRectangle(s1x, row1Y, stripW, stripRowH, C_BORDER)
  lcd.drawText(s1x + stripW / 2, row1Y + 8, "LINK", SMLSIZE + CENTER + BLACK)
  lcd.drawText(s1x + stripW / 2, row1Y + 28, rqlyStr, MIDSIZE + CENTER + BLACK)

  lcd.drawFilledRectangle(s2x, row1Y, stripW, stripRowH, C_CARD)
  lcd.drawRectangle(s2x, row1Y, stripW, stripRowH, C_BORDER)
  lcd.drawText(s2x + stripW / 2, row1Y + 8, "CURRENT", SMLSIZE + CENTER + BLACK)
  lcd.drawText(s2x + stripW / 2, row1Y + 28, currStr, MIDSIZE + CENTER + BLACK)

  lcd.drawFilledRectangle(s3x, row1Y, stripW, stripRowH, C_CARD)
  lcd.drawRectangle(s3x, row1Y, stripW, stripRowH, C_BORDER)
  lcd.drawText(s3x + stripW / 2, row1Y + 8, "TIMER", SMLSIZE + CENTER + BLACK)
  lcd.drawText(s3x + stripW / 2, row1Y + 28, timerStr, MIDSIZE + CENTER + BLACK)

  lcd.drawFilledRectangle(s0x, row2Y, stripW, stripRowH, C_CARD)
  lcd.drawRectangle(s0x, row2Y, stripW, stripRowH, C_BORDER)
  lcd.drawText(s0x + stripW / 2, row2Y + 8, "BATTERY", SMLSIZE + CENTER + BLACK)
  lcd.drawText(s0x + stripW / 2, row2Y + 28, batPctStr, MIDSIZE + CENTER + BLACK)

  lcd.drawFilledRectangle(s1x, row2Y, stripW, stripRowH, C_CARD)
  lcd.drawRectangle(s1x, row2Y, stripW, stripRowH, C_BORDER)
  lcd.drawText(s1x + stripW / 2, row2Y + 8, "USED", SMLSIZE + CENTER + BLACK)
  lcd.drawText(s1x + stripW / 2, row2Y + 28, capaStr, MIDSIZE + CENTER + BLACK)

  lcd.drawFilledRectangle(s2x, row2Y, stripW, stripRowH, C_CARD)
  lcd.drawRectangle(s2x, row2Y, stripW, stripRowH, C_BORDER)
  lcd.drawText(s2x + stripW / 2, row2Y + 8, "ALTITUDE", SMLSIZE + CENTER + BLACK)
  lcd.drawText(s2x + stripW / 2, row2Y + 28, altStr, MIDSIZE + CENTER + BLACK)

  lcd.drawFilledRectangle(s3x, row2Y, stripW, stripRowH, C_CARD)
  lcd.drawRectangle(s3x, row2Y, stripW, stripRowH, C_BORDER)
  lcd.drawText(s3x + stripW / 2, row2Y + 8, "MODE", SMLSIZE + CENTER + BLACK)
  lcd.drawText(s3x + stripW / 2, row2Y + 28, fmStr, MIDSIZE + CENTER + BLACK)

  local footerY = h - footerH
  lcd.drawFilledRectangle(0, footerY, w, footerH, C_CARD)
  lcd.drawRectangle(0, footerY, w, footerH, C_BORDER)
  lcd.drawText(pad, footerY + 8, statusStr, SMLSIZE + statusColor)
  lcd.drawText(w / 2, footerY + 8, fmStr, SMLSIZE + CENTER + BLACK)
  lcd.drawText(w - pad, footerY + 8, trssStr, SMLSIZE + RIGHT + BLACK)
end

return {
  name = name,
  options = options,
  create = create,
  update = update,
  refresh = refresh,
}
`;
