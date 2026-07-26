/**
 * Complete Layout template boards for gallery → editor (no AI).
 * RF heli boards still assemble via prefab sections; these cover BF/CRSF stubs.
 */

import { createStarterSource } from "./luaDocument.ts";

export type LayoutTemplateBoardId =
  | "starter"
  | "minimal"
  | "minimal-quad"
  | "dense-crsf"
  | "whoop"
  | "freestyle-quad"
  | "battery-tool"
  | "flight-logger";

const SHARED_HELPERS = `local function cacheSource(sensorName)
  local idx = getSourceIndex(sensorName)
  if idx and idx > 0 then return idx end
  return nil
end

local function telem(id)
  if id then return getValue(id) end
  return 0
end
`;

/** Large voltage hero + link/timer secondaries — freestyle minimal. */
export const MINIMAL_QUAD_BOARD = `---@type WidgetScript
---@simulate Layout1x1 zone=0
-- Minimal quad — voltage hero, link strip, timer

local name = "MinQuad"

local options = {
  { "ShowAlt", BOOL, 1 },
  { "ShowTimer", BOOL, 1 },
  { "TextColor", COLOR, WHITE },
  { "BgColor", COLOR, BLACK },
}

${SHARED_HELPERS}
local function create(zone, opts)
  return {
    zone = zone,
    options = opts,
    src = {
      rqly = cacheSource("RQLY"),
      rxbt = cacheSource("RxBt"),
      alt = cacheSource("Alt"),
      curr = cacheSource("Curr"),
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

  local volts = telem(widget.src.rxbt)
  local rqly = telem(widget.src.rqly)
  local amps = telem(widget.src.curr)
  local alt = telem(widget.src.alt)
  local vStr = string.format("%.1f", volts)
  local rqlyStr = tostring(math.floor(rqly + 0.5)) .. "%"
  local aStr = string.format("%.0fA", amps)
  local altStr = string.format("%.0fm", alt)
  local tStr = "03:42"

  lcd.clear(bg)

  lcd.drawFilledRectangle(0, 0, w, 40, GREY)
  lcd.drawText(pad, 12, "MINIMAL", MIDSIZE + fg)
  lcd.drawText(w - pad - 56, 14, rqlyStr, SMLSIZE + GREEN)

  lcd.drawText(pad, 64, "PACK", SMLSIZE + GREY)
  lcd.drawText(pad, 84, vStr, DBLSIZE + YELLOW)
  lcd.drawText(pad + 120, 100, "V", MIDSIZE + WHITE)
  lcd.drawText(pad, 140, aStr, MIDSIZE + CYAN)

  if widget.options.ShowTimer == 1 then
    lcd.drawFilledRectangle(w - pad - 160, 64, 148, 88, DARKGREY)
    lcd.drawRectangle(w - pad - 160, 64, 148, 88, GREY)
    lcd.drawText(w - pad - 148, 72, "TIMER", SMLSIZE + GREY)
    lcd.drawText(w - pad - 148, 96, tStr, DBLSIZE + WHITE)
  end

  local barY = 200
  lcd.drawText(pad, barY - 16, "LINK", SMLSIZE + GREY)
  lcd.drawFilledRectangle(pad, barY, w - pad * 2, 14, GREY)
  local fillW = math.floor((w - pad * 2 - 4) * math.max(0, math.min(100, rqly)) / 100)
  if fillW > 0 then
    lcd.drawFilledRectangle(pad + 2, barY + 2, fillW, 10, GREEN)
  end

  if widget.options.ShowAlt == 1 then
    lcd.drawText(pad, 236, "ALT", SMLSIZE + GREY)
    lcd.drawText(pad + 40, 232, altStr, MIDSIZE + CYAN)
  end

  lcd.drawFilledRectangle(0, h - 28, w, 28, DARKGREY)
  lcd.drawText(pad, h - 20, "Ready", SMLSIZE + GREY)
end

return {
  name = name,
  options = options,
  create = create,
  update = update,
  refresh = refresh,
}
`;

/** Dense CRSF telemetry grid with header + GPS strip. */
export const DENSE_CRSF_BOARD = `---@type WidgetScript
---@simulate Layout1x1 zone=0
-- Dense CRSF grid — link, power, GPS, attitude cells

local name = "DenseCRSF"

local options = {
  { "ShowGPS", BOOL, 1 },
  { "ShowAtt", BOOL, 1 },
  { "TextColor", COLOR, WHITE },
  { "BgColor", COLOR, BLACK },
}

${SHARED_HELPERS}
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
      pitch = cacheSource("Ptch"),
      roll = cacheSource("Roll"),
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
  local headerH = 40
  local cols = 3
  local rows = 2
  local gap = 8
  local cellW = math.floor((w - pad * 2 - gap * (cols - 1)) / cols)
  local cellH = 72
  local startY = headerH + pad

  local rqly = telem(widget.src.rqly)
  local rssi = telem(widget.src.rssi)
  local volts = telem(widget.src.rxbt)
  local amps = telem(widget.src.curr)
  local alt = telem(widget.src.alt)
  local gspd = telem(widget.src.gspd)
  local sats = telem(widget.src.sats)
  local pitch = telem(widget.src.pitch)
  local roll = telem(widget.src.roll)
  local fm = telem(widget.src.fm)

  local cells = {
    { "RQLY", tostring(math.floor(rqly + 0.5)) .. "%" },
    { "1RSS", tostring(math.floor(rssi + 0.5)) },
    { "VOLT", string.format("%.1fV", volts) },
    { "CURR", string.format("%.1fA", amps) },
    { "ALT", string.format("%.0fm", alt) },
    { "GSPD", string.format("%.0f", gspd) },
  }

  lcd.clear(bg)
  lcd.drawFilledRectangle(0, 0, w, headerH, GREY)
  lcd.drawText(pad, 12, "CRSF GRID", MIDSIZE + fg)
  lcd.drawText(w - pad - 48, 14, tostring(sats) .. " sat", SMLSIZE + CYAN)

  -- Unrolled 2x3 grid (editor preview parses direct lcd.* only)
  local x0 = pad
  local x1 = pad + cellW + gap
  local x2 = pad + 2 * (cellW + gap)
  local y0 = startY
  local y1 = startY + cellH + gap
  local c1 = cells[1][2]
  local c2 = cells[2][2]
  local c3 = cells[3][2]
  local c4 = cells[4][2]
  local c5 = cells[5][2]
  local c6 = cells[6][2]

  lcd.drawFilledRectangle(x0, y0, cellW, cellH, DARKGREY)
  lcd.drawRectangle(x0, y0, cellW, cellH, GREY)
  lcd.drawText(x0 + 8, y0 + 8, "RQLY", SMLSIZE + GREY)
  lcd.drawText(x0 + 8, y0 + 28, c1, MIDSIZE + WHITE)

  lcd.drawFilledRectangle(x1, y0, cellW, cellH, DARKGREY)
  lcd.drawRectangle(x1, y0, cellW, cellH, GREY)
  lcd.drawText(x1 + 8, y0 + 8, "1RSS", SMLSIZE + GREY)
  lcd.drawText(x1 + 8, y0 + 28, c2, MIDSIZE + WHITE)

  lcd.drawFilledRectangle(x2, y0, cellW, cellH, DARKGREY)
  lcd.drawRectangle(x2, y0, cellW, cellH, GREY)
  lcd.drawText(x2 + 8, y0 + 8, "VOLT", SMLSIZE + GREY)
  lcd.drawText(x2 + 8, y0 + 28, c3, MIDSIZE + WHITE)

  lcd.drawFilledRectangle(x0, y1, cellW, cellH, DARKGREY)
  lcd.drawRectangle(x0, y1, cellW, cellH, GREY)
  lcd.drawText(x0 + 8, y1 + 8, "CURR", SMLSIZE + GREY)
  lcd.drawText(x0 + 8, y1 + 28, c4, MIDSIZE + WHITE)

  lcd.drawFilledRectangle(x1, y1, cellW, cellH, DARKGREY)
  lcd.drawRectangle(x1, y1, cellW, cellH, GREY)
  lcd.drawText(x1 + 8, y1 + 8, "ALT", SMLSIZE + GREY)
  lcd.drawText(x1 + 8, y1 + 28, c5, MIDSIZE + WHITE)

  lcd.drawFilledRectangle(x2, y1, cellW, cellH, DARKGREY)
  lcd.drawRectangle(x2, y1, cellW, cellH, GREY)
  lcd.drawText(x2 + 8, y1 + 8, "GSPD", SMLSIZE + GREY)
  lcd.drawText(x2 + 8, y1 + 28, c6, MIDSIZE + WHITE)

  local bandY = startY + rows * (cellH + gap)
  if widget.options.ShowAtt == 1 then
    local pitchStr = string.format("P %.0f", pitch)
    local rollStr = string.format("R %.0f", roll)
    lcd.drawFilledRectangle(pad, bandY, w - pad * 2, 40, DARKGREY)
    lcd.drawRectangle(pad, bandY, w - pad * 2, 40, GREY)
    lcd.drawText(pad + 8, bandY + 12, "ATTITUDE", SMLSIZE + GREY)
    lcd.drawText(pad + 100, bandY + 10, pitchStr, MIDSIZE + WHITE)
    lcd.drawText(pad + 220, bandY + 10, rollStr, MIDSIZE + WHITE)
    bandY = bandY + 48
  end

  if widget.options.ShowGPS == 1 then
    local satsLine = "Sats " .. tostring(sats)
    lcd.drawText(pad, bandY, satsLine, SMLSIZE + CYAN)
  end

  lcd.drawFilledRectangle(0, h - 28, w, 28, DARKGREY)
  if type(fm) == "string" and fm ~= "" then
    lcd.drawText(pad, h - 20, fm, SMLSIZE + ORANGE)
  else
    lcd.drawText(pad, h - 20, "CRSF", SMLSIZE + GREY)
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

/** Tiny whoop overview — armed banner, bars, voltage, attitude cards. */
export const WHOOP_BOARD = `---@type WidgetScript
---@simulate Layout1x1 zone=0
-- Tiny whoop overview — armed banner, link/batt bars, voltage + attitude

local name = "Whoop"

local options = {
  { "ShowAtt", BOOL, 1 },
  { "ShowCapa", BOOL, 1 },
  { "TextColor", COLOR, WHITE },
  { "BgColor", COLOR, BLACK },
}

${SHARED_HELPERS}
local function create(zone, opts)
  return {
    zone = zone,
    options = opts,
    src = {
      rqly = cacheSource("RQLY"),
      rxbt = cacheSource("RxBt"),
      curr = cacheSource("Curr"),
      capa = cacheSource("Capa"),
      pitch = cacheSource("Ptch"),
      roll = cacheSource("Roll"),
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

  local rqly = telem(widget.src.rqly)
  local volts = telem(widget.src.rxbt)
  local amps = telem(widget.src.curr)
  local capa = telem(widget.src.capa)
  local pitch = telem(widget.src.pitch)
  local roll = telem(widget.src.roll)
  local fm = telem(widget.src.fm)
  local armed = type(fm) == "string" and string.find(string.upper(tostring(fm)), "ARM") ~= nil

  local vStr = string.format("%.2f", volts)
  local aStr = string.format("%.1fA", amps)
  local capaStr = string.format("%.0f mAh", capa)
  local pitchStr = string.format("%.0f", pitch)
  local rollStr = string.format("%.0f", roll)
  local rqlyStr = tostring(math.floor(rqly + 0.5)) .. "%"
  local battPct = math.max(0, math.min(100, (volts - 3.3) / (4.2 - 3.3) * 100))

  lcd.clear(bg)

  if armed then
    lcd.drawFilledRectangle(0, 0, w, 36, ORANGE)
    lcd.drawText(pad, 10, "ARMED", MIDSIZE + BLACK)
  else
    lcd.drawFilledRectangle(0, 0, w, 36, GREY)
    lcd.drawText(pad, 10, "WHOOP", MIDSIZE + fg)
  end
  lcd.drawText(w - pad - 48, 12, rqlyStr, SMLSIZE + GREEN)

  local barX = pad
  local barW = w - pad * 2
  lcd.drawText(barX, 48, "LINK", SMLSIZE + GREY)
  lcd.drawFilledRectangle(barX, 64, barW, 12, GREY)
  local linkFill = math.floor((barW - 4) * math.max(0, math.min(100, rqly)) / 100)
  if linkFill > 0 then
    lcd.drawFilledRectangle(barX + 2, 66, linkFill, 8, GREEN)
  end

  lcd.drawText(barX, 88, "BATT", SMLSIZE + GREY)
  lcd.drawFilledRectangle(barX, 104, barW, 12, GREY)
  local battFill = math.floor((barW - 4) * battPct / 100)
  if battFill > 0 then
    lcd.drawFilledRectangle(barX + 2, 106, battFill, 8, YELLOW)
  end

  local cardY = 132
  local colW = math.floor((w - pad * 3) / 2)
  lcd.drawFilledRectangle(pad, cardY, colW, 100, DARKGREY)
  lcd.drawRectangle(pad, cardY, colW, 100, GREY)
  lcd.drawText(pad + 8, cardY + 8, "VOLTAGE", SMLSIZE + GREY)
  lcd.drawText(pad + 8, cardY + 28, vStr, DBLSIZE + YELLOW)
  lcd.drawText(pad + 8, cardY + 72, aStr, MIDSIZE + WHITE)

  local rx = pad * 2 + colW
  lcd.drawFilledRectangle(rx, cardY, colW, 100, DARKGREY)
  lcd.drawRectangle(rx, cardY, colW, 100, GREY)
  if widget.options.ShowAtt == 1 then
    lcd.drawText(rx + 8, cardY + 8, "PITCH / ROLL", SMLSIZE + GREY)
    lcd.drawText(rx + 8, cardY + 32, pitchStr, MIDSIZE + WHITE)
    lcd.drawText(rx + 8, cardY + 60, rollStr, MIDSIZE + WHITE)
  else
    lcd.drawText(rx + 8, cardY + 8, "CURRENT", SMLSIZE + GREY)
    lcd.drawText(rx + 8, cardY + 32, aStr, DBLSIZE + CYAN)
  end

  if widget.options.ShowCapa == 1 then
    lcd.drawText(pad, 248, "CAPA", SMLSIZE + GREY)
    lcd.drawText(pad + 48, 244, capaStr, MIDSIZE + CYAN)
  end

  lcd.drawFilledRectangle(0, h - 28, w, 28, DARKGREY)
  if type(fm) == "string" and fm ~= "" then
    lcd.drawText(pad, h - 20, fm, SMLSIZE + ORANGE)
  else
    lcd.drawText(pad, h - 20, "Disarmed", SMLSIZE + GREY)
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

/** Freestyle quad — timer hero, pack + current, link, GPS row. */
export const FREESTYLE_QUAD_BOARD = `---@type WidgetScript
---@simulate Layout1x1 zone=0
-- Freestyle quad — timer hero, pack/current strip, link, GPS

local name = "FreeStyl"

local options = {
  { "ShowGPS", BOOL, 1 },
  { "ShowArmed", BOOL, 1 },
  { "TextColor", COLOR, WHITE },
  { "BgColor", COLOR, BLACK },
}

${SHARED_HELPERS}
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
  local headerH = 40

  local rqly = telem(widget.src.rqly)
  local rssi = telem(widget.src.rssi)
  local volts = telem(widget.src.rxbt)
  local amps = telem(widget.src.curr)
  local alt = telem(widget.src.alt)
  local gspd = telem(widget.src.gspd)
  local sats = telem(widget.src.sats)
  local fm = telem(widget.src.fm)
  local armed = type(fm) == "string" and string.find(string.upper(tostring(fm)), "ARM") ~= nil

  local tStr = "04:18"
  local vStr = string.format("%.1fV", volts)
  local aStr = string.format("%.1fA", amps)
  local rqlyStr = tostring(math.floor(rqly + 0.5)) .. "%"
  local rssiStr = tostring(math.floor(rssi + 0.5))
  local altStr = string.format("%.0f m", alt)
  local spdStr = string.format("%.0f km/h", gspd)
  local satsStr = tostring(sats)

  lcd.clear(bg)
  lcd.drawFilledRectangle(0, 0, w, headerH, GREY)
  lcd.drawText(pad, 12, "FREESTYLE", MIDSIZE + fg)
  if widget.options.ShowArmed == 1 then
    if armed then
      lcd.drawFilledRectangle(w - pad - 72, 8, 60, 24, ORANGE)
      lcd.drawText(w - pad - 60, 12, "ARM", SMLSIZE + BLACK)
    else
      lcd.drawText(w - pad - 56, 14, "SAFE", SMLSIZE + GREEN)
    end
  end

  lcd.drawText(pad, 56, "TIMER", SMLSIZE + GREY)
  lcd.drawText(pad, 76, tStr, DBLSIZE + WHITE)

  local stripY = 130
  local colW = math.floor((w - pad * 4) / 3)
  lcd.drawFilledRectangle(pad, stripY, colW, 72, DARKGREY)
  lcd.drawRectangle(pad, stripY, colW, 72, GREY)
  lcd.drawText(pad + 8, stripY + 8, "PACK", SMLSIZE + GREY)
  lcd.drawText(pad + 8, stripY + 28, vStr, MIDSIZE + YELLOW)

  local x2 = pad * 2 + colW
  lcd.drawFilledRectangle(x2, stripY, colW, 72, DARKGREY)
  lcd.drawRectangle(x2, stripY, colW, 72, GREY)
  lcd.drawText(x2 + 8, stripY + 8, "CURR", SMLSIZE + GREY)
  lcd.drawText(x2 + 8, stripY + 28, aStr, MIDSIZE + CYAN)

  local x3 = pad * 3 + colW * 2
  lcd.drawFilledRectangle(x3, stripY, colW, 72, DARKGREY)
  lcd.drawRectangle(x3, stripY, colW, 72, GREY)
  lcd.drawText(x3 + 8, stripY + 8, "LINK", SMLSIZE + GREY)
  lcd.drawText(x3 + 8, stripY + 28, rqlyStr, MIDSIZE + GREEN)
  lcd.drawText(x3 + 8, stripY + 50, rssiStr, SMLSIZE + WHITE)

  if widget.options.ShowGPS == 1 then
    local gy = 220
    lcd.drawFilledRectangle(pad, gy, w - pad * 2, 52, DARKGREY)
    lcd.drawRectangle(pad, gy, w - pad * 2, 52, GREY)
    lcd.drawText(pad + 8, gy + 8, "GPS", SMLSIZE + GREY)
    lcd.drawText(pad + 8, gy + 26, altStr, MIDSIZE + WHITE)
    lcd.drawText(pad + 140, gy + 26, spdStr, MIDSIZE + WHITE)
    lcd.drawText(pad + 300, gy + 26, satsStr, MIDSIZE + CYAN)
  end

  lcd.drawFilledRectangle(0, h - 28, w, 28, DARKGREY)
  if type(fm) == "string" and fm ~= "" then
    lcd.drawText(pad, h - 20, fm, SMLSIZE + ORANGE)
  else
    lcd.drawText(pad, h - 20, "Freestyle", SMLSIZE + GREY)
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

/** Battery + pack tool dashboard (pairs with batt-select companion). */
export const BATTERY_TOOL_BOARD = `---@type WidgetScript
---@simulate Layout1x1 zone=0
-- Battery tool board — pack voltage hero, cells, capacity, current

local name = "BattTool"

local options = {
  { "Cells", VALUE, 4, 1, 8 },
  { "ShowCapa", BOOL, 1 },
  { "TextColor", COLOR, WHITE },
  { "BgColor", COLOR, BLACK },
}

${SHARED_HELPERS}
local function create(zone, opts)
  return {
    zone = zone,
    options = opts,
    src = {
      rqly = cacheSource("RQLY"),
      rxbt = cacheSource("RxBt"),
      curr = cacheSource("Curr"),
      capa = cacheSource("Capa"),
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
  local cells = widget.options.Cells
  if cells < 1 then cells = 4 end

  local volts = telem(widget.src.rxbt)
  local amps = telem(widget.src.curr)
  local capa = telem(widget.src.capa)
  local rqly = telem(widget.src.rqly)
  local fm = telem(widget.src.fm)
  local packFromGv = model.getGlobalVariable(3, 0) or 0
  if packFromGv >= 1 and packFromGv <= 8 then
    cells = packFromGv
  end
  local cellV = 0
  if cells > 0 then
    cellV = volts / cells
  end
  local battPct = math.max(0, math.min(100, (cellV - 3.3) / (4.2 - 3.3) * 100))

  local vStr = string.format("%.2f", volts)
  local cellStr = string.format("%.2f V/c", cellV)
  local aStr = string.format("%.1f A", amps)
  local capaStr = string.format("%.0f mAh", capa)
  local cellsStr = tostring(cells) .. "S"
  local pctStr = tostring(math.floor(battPct + 0.5)) .. "%"
  local rqlyStr = tostring(math.floor(rqly + 0.5)) .. "%"

  lcd.clear(bg)
  lcd.drawFilledRectangle(0, 0, w, 40, GREY)
  lcd.drawText(pad, 12, "BATTERY", MIDSIZE + fg)
  lcd.drawText(w - pad - 40, 14, cellsStr, MIDSIZE + CYAN)

  lcd.drawText(pad, 56, "PACK", SMLSIZE + GREY)
  lcd.drawText(pad, 76, vStr, DBLSIZE + YELLOW)
  lcd.drawText(pad + 140, 92, "V", MIDSIZE + WHITE)
  lcd.drawText(pad, 120, cellStr, MIDSIZE + WHITE)

  local barY = 156
  lcd.drawFilledRectangle(pad, barY, w - pad * 2, 18, GREY)
  local fillW = math.floor((w - pad * 2 - 4) * battPct / 100)
  if fillW > 0 then
    lcd.drawFilledRectangle(pad + 2, barY + 2, fillW, 14, YELLOW)
  end
  lcd.drawText(pad, barY + 28, pctStr, SMLSIZE + GREY)

  local cardY = 208
  local colW = math.floor((w - pad * 3) / 2)
  lcd.drawFilledRectangle(pad, cardY, colW, 64, DARKGREY)
  lcd.drawRectangle(pad, cardY, colW, 64, GREY)
  lcd.drawText(pad + 8, cardY + 8, "CURRENT", SMLSIZE + GREY)
  lcd.drawText(pad + 8, cardY + 28, aStr, MIDSIZE + CYAN)

  local rx = pad * 2 + colW
  lcd.drawFilledRectangle(rx, cardY, colW, 64, DARKGREY)
  lcd.drawRectangle(rx, cardY, colW, 64, GREY)
  if widget.options.ShowCapa == 1 then
    lcd.drawText(rx + 8, cardY + 8, "CAPACITY", SMLSIZE + GREY)
    lcd.drawText(rx + 8, cardY + 28, capaStr, MIDSIZE + WHITE)
  else
    lcd.drawText(rx + 8, cardY + 8, "LINK", SMLSIZE + GREY)
    lcd.drawText(rx + 8, cardY + 28, rqlyStr, MIDSIZE + GREEN)
  end

  lcd.drawFilledRectangle(0, h - 28, w, 28, DARKGREY)
  lcd.drawText(pad, h - 20, "Pack via TOOLS/batt_select · GV3", SMLSIZE + GREY)
  if type(fm) == "string" and fm ~= "" then
    lcd.drawText(w - pad - 80, h - 20, fm, SMLSIZE + ORANGE)
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

/** Flight logger suite dashboard — live strip + last-flight summary. */
export const FLIGHT_LOGGER_BOARD = `---@type WidgetScript
---@simulate Layout1x1 zone=0
-- Flight logger board — live metrics + GV1 flight count / last summary

local name = "FltLog"

local options = {
  { "ShowGPS", BOOL, 1 },
  { "TextColor", COLOR, WHITE },
  { "BgColor", COLOR, BLACK },
}

${SHARED_HELPERS}
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

  local rqly = telem(widget.src.rqly)
  local volts = telem(widget.src.rxbt)
  local amps = telem(widget.src.curr)
  local alt = telem(widget.src.alt)
  local gspd = telem(widget.src.gspd)
  local sats = telem(widget.src.sats)
  local fm = telem(widget.src.fm)
  local flights = model.getGlobalVariable(1, 0) or 0

  local vStr = string.format("%.1fV", volts)
  local aStr = string.format("%.1fA", amps)
  local rqlyStr = tostring(math.floor(rqly + 0.5)) .. "%"
  local altStr = string.format("%.0fm", alt)
  local spdStr = string.format("%.0f km/h", gspd)
  local satsStr = tostring(sats)
  local flightStr = "Flights: " .. tostring(flights)
  local lastLine = "Last: see TOOLS/log_view"

  lcd.clear(bg)
  lcd.drawFilledRectangle(0, 0, w, 40, GREY)
  lcd.drawText(pad, 12, "FLIGHT LOG", MIDSIZE + fg)
  lcd.drawText(w - pad - 100, 14, flightStr, SMLSIZE + CYAN)

  local colW = math.floor((w - pad * 3) / 2)
  local cardY = 52
  lcd.drawFilledRectangle(pad, cardY, colW, 96, DARKGREY)
  lcd.drawRectangle(pad, cardY, colW, 96, GREY)
  lcd.drawText(pad + 8, cardY + 8, "LINK", SMLSIZE + GREY)
  lcd.drawText(pad + 8, cardY + 28, rqlyStr, MIDSIZE + GREEN)
  lcd.drawFilledRectangle(pad + 8, cardY + 64, colW - 16, 10, GREY)
  local fillW = math.floor((colW - 20) * math.max(0, math.min(100, rqly)) / 100)
  if fillW > 0 then
    lcd.drawFilledRectangle(pad + 8, cardY + 64, fillW, 10, GREEN)
  end

  local rx = pad * 2 + colW
  lcd.drawFilledRectangle(rx, cardY, colW, 96, DARKGREY)
  lcd.drawRectangle(rx, cardY, colW, 96, GREY)
  lcd.drawText(rx + 8, cardY + 8, "POWER", SMLSIZE + GREY)
  lcd.drawText(rx + 8, cardY + 28, vStr, MIDSIZE + YELLOW)
  lcd.drawText(rx + 8, cardY + 56, aStr, MIDSIZE + WHITE)

  local sumY = 164
  lcd.drawFilledRectangle(pad, sumY, w - pad * 2, 56, DARKGREY)
  lcd.drawRectangle(pad, sumY, w - pad * 2, 56, GREY)
  lcd.drawText(pad + 8, sumY + 8, "SESSION", SMLSIZE + GREY)
  lcd.drawText(pad + 8, sumY + 28, lastLine, MIDSIZE + WHITE)

  if widget.options.ShowGPS == 1 then
    local gy = 236
    lcd.drawText(pad, gy, "ALT", SMLSIZE + GREY)
    lcd.drawText(pad + 36, gy - 2, altStr, MIDSIZE + WHITE)
    lcd.drawText(pad + 140, gy, "SPD", SMLSIZE + GREY)
    lcd.drawText(pad + 180, gy - 2, spdStr, MIDSIZE + WHITE)
    lcd.drawText(pad + 320, gy, "SAT", SMLSIZE + GREY)
    lcd.drawText(pad + 352, gy - 2, satsStr, MIDSIZE + CYAN)
  end

  lcd.drawFilledRectangle(0, h - 28, w, 28, DARKGREY)
  lcd.drawText(pad, h - 20, "TELEMETRY/flight_log + TOOLS/log_view", SMLSIZE + GREY)
  if type(fm) == "string" and fm ~= "" then
    lcd.drawText(w - pad - 72, h - 20, fm, SMLSIZE + ORANGE)
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

const BOARD_BY_ID: Record<LayoutTemplateBoardId, string> = {
  starter: "", // resolved via createStarterSource()
  minimal: MINIMAL_QUAD_BOARD,
  "minimal-quad": MINIMAL_QUAD_BOARD,
  "dense-crsf": DENSE_CRSF_BOARD,
  whoop: WHOOP_BOARD,
  "freestyle-quad": FREESTYLE_QUAD_BOARD,
  "battery-tool": BATTERY_TOOL_BOARD,
  "flight-logger": FLIGHT_LOGGER_BOARD,
};

/** Resolve Lua source for a non-RF gallery layout prefab. */
export function getLayoutTemplateBoardSource(
  boardId: string | null | undefined,
): string {
  if (!boardId || boardId === "starter") return createStarterSource();
  const source = BOARD_BY_ID[boardId as LayoutTemplateBoardId];
  if (source) return source;
  return createStarterSource();
}

export function isLayoutTemplateBoardId(
  id: string,
): id is LayoutTemplateBoardId {
  return id in BOARD_BY_ID;
}
