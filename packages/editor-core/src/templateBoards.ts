/**
 * Complete Layout template boards for gallery → editor (no AI).
 * Whoop / freestyle / minimal / dense CRSF boards assemble from betaflight-quad
 * prefab sections. Battery + flight-logger remain monolithic (companion suites).
 */

import { createStarterSource } from "./luaDocument.ts";
import {
  createPrefabShellSource,
  DENSE_CRSF_LAYOUT_ORDER,
  FREESTYLE_LAYOUT_ORDER,
  insertPrefabSections,
  MINIMAL_QUAD_LAYOUT_ORDER,
  WHOOP_LAYOUT_ORDER,
} from "./prefabs/index.ts";

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


const MONOLITH_BOARDS: Partial<Record<LayoutTemplateBoardId, string>> = {
  "battery-tool": BATTERY_TOOL_BOARD,
  "flight-logger": FLIGHT_LOGGER_BOARD,
};

const PREFAB_BOARD_ORDERS: Partial<
  Record<LayoutTemplateBoardId, readonly string[]>
> = {
  minimal: MINIMAL_QUAD_LAYOUT_ORDER,
  "minimal-quad": MINIMAL_QUAD_LAYOUT_ORDER,
  "dense-crsf": DENSE_CRSF_LAYOUT_ORDER,
  whoop: WHOOP_LAYOUT_ORDER,
  "freestyle-quad": FREESTYLE_LAYOUT_ORDER,
};

const BOARD_IDS: Record<LayoutTemplateBoardId, true> = {
  starter: true,
  minimal: true,
  "minimal-quad": true,
  "dense-crsf": true,
  whoop: true,
  "freestyle-quad": true,
  "battery-tool": true,
  "flight-logger": true,
};

/** Resolve Lua source for a non-RF gallery layout prefab. */
export function getLayoutTemplateBoardSource(
  boardId: string | null | undefined,
  options?: { lcdW?: number; lcdH?: number },
): string {
  if (!boardId || boardId === "starter") return createStarterSource();
  const id = boardId as LayoutTemplateBoardId;
  const order = PREFAB_BOARD_ORDERS[id];
  if (order) {
    const shellName =
      id === "whoop"
        ? "Whoop"
        : id === "freestyle-quad"
          ? "FreeStyl"
          : id === "dense-crsf"
            ? "DenseCRSF"
            : "Minimal";
    const { source } = insertPrefabSections(
      createPrefabShellSource(shellName),
      [...order],
      options,
    );
    return source;
  }
  const monolith = MONOLITH_BOARDS[id];
  if (monolith) return monolith;
  return createStarterSource();
}

export function isLayoutTemplateBoardId(
  id: string,
): id is LayoutTemplateBoardId {
  return id in BOARD_IDS;
}
