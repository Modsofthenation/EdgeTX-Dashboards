---@type WidgetScript
---@simulate Layout1x1 zone=0
-- TX15 RF heli-style Rotorflight sections (prefab assembly)

local name = "RfHeliTx"

local options = {
  { "ShowLink", BOOL, 1 },
  { "ShowHead", BOOL, 1 },
  { "ShowMotor", BOOL, 1 },
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
      rss1 = cacheSource("1RSS"),
      fm = cacheSource("FM"),
      gov = cacheSource("Gov"),
      hspd = cacheSource("HSpd"),
      rpm = cacheSource("RPM"),
      tspd = cacheSource("Tspd"),
      curr = cacheSource("Curr"),
      rxbt = cacheSource("RxBt"),
      vcel = cacheSource("Vcel"),
      vbec = cacheSource("Vbec"),
      esct = cacheSource("EscT"),
      mott = cacheSource("MotT"),
      batp = cacheSource("Bat%"),
      capa = cacheSource("Capa"),
      vbat = cacheSource("Vbat"),
    },
  }
end

local function update(widget, opts)
  widget.options = opts
end

local function refresh(widget, event, touchState)
  lcd.clear(BLACK)
  -- prefab:rf-topbar-link
  local rqlyTop = telem(widget.src.rqly)
  local rqlyTopStr = rqlyTop > 0 and (tostring(math.floor(rqlyTop + 0.5)) .. "%") or "---"
  local t1 = model.getTimer(1)
  local tSecs = (t1 and t1.value) and math.floor(math.abs(t1.value)) or 0
  local timerStr = string.format("%d:%02d", math.floor(tSecs / 60), tSecs % 60)
  lcd.drawFilledRectangle(0, 0, 480, 36, GREY)
  lcd.drawText(12, 10, "HELI", SMLSIZE + WHITE)
  lcd.drawText(200, 8, timerStr, MIDSIZE + WHITE)
  local sigX = 360
  local sigY = 22
  local activeBars = math.floor((math.max(0, math.min(100, rqlyTop)) + 24) / 25)
  lcd.drawFilledRectangle(sigX, sigY - 6, 6, 6, rqlyTop > 0 and activeBars >= 1 and RED or DARKGREY)
  lcd.drawFilledRectangle(sigX + 10, sigY - 10, 6, 10, rqlyTop > 0 and activeBars >= 2 and ORANGE or DARKGREY)
  lcd.drawFilledRectangle(sigX + 20, sigY - 14, 6, 14, rqlyTop > 0 and activeBars >= 3 and YELLOW or DARKGREY)
  lcd.drawFilledRectangle(sigX + 30, sigY - 18, 6, 18, rqlyTop > 0 and activeBars >= 4 and GREEN or DARKGREY)
  lcd.drawText(430, 10, rqlyTopStr, SMLSIZE + WHITE)
  -- prefab:rf-model-panel
  lcd.drawFilledRectangle(12, 48, 156, 120, DARKGREY)
  lcd.drawRectangle(12, 48, 156, 120, GREY)
  lcd.drawText(20, 56, "MODEL", SMLSIZE + GREY)
  lcd.drawFilledRectangle(20, 72, 140, 70, BLACK)
  lcd.drawText(90, 98, "IMG", SMLSIZE + CENTER + GREY)
  lcd.drawFilledRectangle(20, 148, 140, 1, GREY)
  lcd.drawText(90, 152, "0 Flights", SMLSIZE + CENTER + WHITE)
  -- prefab:rf-governor-card
  local govRaw = telem(widget.src.gov)
  local fmRaw = widget.src.fm and getValue(widget.src.fm) or nil
  local govStr = "--"
  if type(fmRaw) == "string" and #fmRaw > 0 then govStr = fmRaw
  elseif govRaw and govRaw ~= 0 then govStr = tostring(math.floor(govRaw))
  end
  lcd.drawFilledRectangle(12, 180, 156, 72, DARKGREY)
  lcd.drawRectangle(12, 180, 156, 72, GREY)
  lcd.drawText(90, 188, "GOVERNOR", SMLSIZE + CENTER + GREY)
  lcd.drawText(90, 208, govStr, MIDSIZE + CENTER + WHITE)
  -- prefab:rf-headspeed-hero
  local hspd = telem(widget.src.hspd)
  local tspd = telem(widget.src.tspd)
  local hspdStr = hspd > 0 and tostring(math.floor(hspd + 0.5)) or "--"
  local tspdStr = tspd > 0 and tostring(math.floor(tspd + 0.5)) or "--"
  lcd.drawFilledRectangle(180, 48, 288, 100, DARKGREY)
  lcd.drawRectangle(180, 48, 288, 100, GREY)
  lcd.drawText(192, 56, "HEADSPEED RPM", SMLSIZE + GREY)
  lcd.drawText(192, 78, hspdStr, DBLSIZE + WHITE)
  lcd.drawText(360, 72, "tail", SMLSIZE + GREY)
  lcd.drawText(456, 72, tspdStr, SMLSIZE + RIGHT + WHITE)
  lcd.drawText(360, 96, "rpm", SMLSIZE + GREY)
  -- prefab:rf-motor-tiles
  local amps = telem(widget.src.curr)
  local vcel = telem(widget.src.vcel)
  local vpack = telem(widget.src.rxbt)
  local vbec = telem(widget.src.vbec)
  local esct = telem(widget.src.esct)
  local ampsStr = amps > 0 and tostring(math.ceil(amps)) or "--"
  local cellV = vcel > 0 and vcel or (vpack > 0 and vpack / 6 or 0)
  local cellStr = cellV > 0 and string.format("%.2f", cellV) or "--"
  local becStr = vbec > 0 and string.format("%.1f", vbec) or "--"
  local escStr = esct > 0 and tostring(math.floor(esct + 0.5)) or "--"
  lcd.drawFilledRectangle(180, 160, 288, 72, DARKGREY)
  lcd.drawRectangle(180, 160, 288, 72, GREY)
  lcd.drawFilledRectangle(250, 168, 1, 56, GREY)
  lcd.drawFilledRectangle(322, 168, 1, 56, GREY)
  lcd.drawFilledRectangle(394, 168, 1, 56, GREY)
  lcd.drawText(186, 168, "AMPS", SMLSIZE + GREY)
  lcd.drawText(186, 188, ampsStr, MIDSIZE + WHITE)
  lcd.drawText(258, 168, "CELL", SMLSIZE + GREY)
  lcd.drawText(258, 188, cellStr, MIDSIZE + WHITE)
  lcd.drawText(330, 168, "BEC", SMLSIZE + GREY)
  lcd.drawText(330, 188, becStr, MIDSIZE + WHITE)
  lcd.drawText(402, 168, "ESC T", SMLSIZE + GREY)
  lcd.drawText(402, 188, escStr, MIDSIZE + WHITE)
  -- prefab:rf-battery-bar
  local batp = telem(widget.src.batp)
  local volts = telem(widget.src.vbat)
  if volts <= 0 then volts = telem(widget.src.rxbt) end
  local capa = telem(widget.src.capa)
  local pct = math.max(0, math.min(100, batp))
  local header = "BATTERY"
  if volts > 0 then header = header .. string.format(" · %.1fV", volts) end
  if capa > 0 then header = header .. string.format(" · %d mAh used", math.floor(capa)) end
  local barColor = GREEN
  if pct < 20 then barColor = RED elseif pct < 50 then barColor = YELLOW end
  local pctStr = batp > 0 and (tostring(math.floor(pct + 0.5)) .. "%") or "NO DATA"
  lcd.drawText(12, 248, header, SMLSIZE + GREY)
  lcd.drawFilledRectangle(12, 264, 456, 32, DARKGREY)
  lcd.drawRectangle(12, 264, 456, 32, GREY)
  local fillW = math.floor(452 * pct / 100)
  if batp > 0 and fillW > 0 then
    lcd.drawFilledRectangle(14, 266, fillW, 28, barColor)
  end
  lcd.drawText(240, 272, pctStr, SMLSIZE + CENTER + WHITE)
end

return {
  name = name,
  options = options,
  create = create,
  update = update,
  refresh = refresh,
}
