import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  parseLuaToDrawCommands,
  getLastPreviewParseMeta,
} from "./luaPreviewEngine.ts";
import { BASE_MOCK } from "./mockTelemetry.ts";
import { BFMODEL_DT8_SOURCE } from "./fixtures/bfmodel-dt8.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const heliExample = readFileSync(
  join(__dirname, "../../../../examples/tx15-rotorflight-heli.lua"),
  "utf8",
);

describe("parseLuaToDrawCommands", () => {
  it("renders heli dashboard cards at distinct Y positions", () => {
    const cmds = parseLuaToDrawCommands(heliExample, BASE_MOCK);
    const fills = cmds.filter((c) => c.kind === "filledRect");
    const texts = cmds.filter((c) => c.kind === "text");

    assert.ok(fills.length >= 5, `expected card rects, got ${fills.length}`);
    const ys = new Set(fills.map((c) => c.y));
    assert.ok(
      ys.size >= 3,
      `expected varied Y coords, got ${[...ys].join(",")}`,
    );

    const link = texts.find((t) => t.text === "LINK");
    assert.ok(link && (link.y ?? 0) > 40, "LINK should be below header");

    const bad = texts.find((t) => t.text?.includes(".."));
    assert.equal(bad, undefined, `unresolved concat in preview: ${bad?.text}`);
  });

  it("evaluates tostring() in drawText args", () => {
    const source = [
      "---@simulate Layout1x1 zone=0",
      "local function refresh(widget)",
      "  local adjv = 12",
      "  lcd.drawText(10, 300, tostring(adjv), SMLSIZE + YELLOW)",
      "end",
      "return {}",
    ].join("\n");

    const cmds = parseLuaToDrawCommands(source, BASE_MOCK);
    const text = cmds.find((c) => c.kind === "text");
    assert.equal(text?.text, "12");
  });

  it("evaluates string.format and concat in drawText args", () => {
    const source = [
      "---@simulate Layout1x1 zone=0",
      "local function refresh(widget)",
      "  local pad = 12",
      "  local cardY = 52",
      "  local volts = 16.2",
      '  local motorLine = "Motor " .. "3200" .. " ESC " .. "42" .. "C"',
      '  lcd.drawText(10, 22, string.format("%.1f", volts), DBLSIZE + YELLOW)',
      "  lcd.drawText(10, 200, motorLine, SMLSIZE + WHITE)",
      "end",
      "return {}",
    ].join("\n");

    const cmds = parseLuaToDrawCommands(source, BASE_MOCK);
    const voltsText = cmds.find((c) => c.kind === "text" && c.text === "16.2");
    const motorText = cmds.find(
      (c) => c.kind === "text" && c.text?.startsWith("Motor "),
    );
    assert.ok(voltsText);
    assert.equal(motorText?.text, "Motor 3200 ESC 42C");
  });

  it("evaluates heli-style and/or string assignments used by generated dashboards", () => {
    const source = [
      "---@simulate Layout1x1 zone=0",
      "local function create(zone, opts)",
      '  return { src = { rqly = cacheSource("RQLY"), rxbt = cacheSource("RxBt"), curr = cacheSource("Curr"), hspd = cacheSource("HSpd") } }',
      "end",
      "local function refresh(widget)",
      "  local rqly = telem(widget.src.rqly)",
      "  local rqlyNum = math.floor(rqly + 0.5)",
      '  local rqlyStr = rqly > 0 and (tostring(rqlyNum) .. "%") or "---"',
      "  local amps = telem(widget.src.curr)",
      '  local ampStr = amps > 0 and (string.format("%.1f", amps) .. "A") or "0.0A"',
      "  local hspd = telem(widget.src.hspd)",
      '  local hspdStr = hspd > 0 and tostring(math.floor(hspd + 0.5)) or "--"',
      "  lcd.drawText(10, 24, rqlyStr, MIDSIZE + GREEN)",
      "  lcd.drawText(200, 24, ampStr, SMLSIZE + WHITE)",
      "  lcd.drawText(10, 80, hspdStr, DBLSIZE + CYAN)",
      "end",
      "return {}",
    ].join("\n");

    const cmds = parseLuaToDrawCommands(source, BASE_MOCK);
    const texts = cmds.filter((c) => c.kind === "text").map((c) => c.text);
    const bad = texts.find(
      (t) => t?.includes(" and ") || t?.includes("string.format"),
    );
    assert.equal(bad, undefined, `unevaluated expression in preview: ${bad}`);
    assert.ok(
      texts.some((t) => t?.includes("%")),
      `expected RQLY percent, got ${texts.join("|")}`,
    );
    assert.ok(
      texts.some((t) => t?.endsWith("A")),
      `expected amps suffix, got ${texts.join("|")}`,
    );
  });

  it("keeps placeholder when rqly is zero (does not force 0%)", () => {
    const source = [
      "---@simulate Layout1x1 zone=0",
      'local function create() return { src = { rqly = cacheSource("RQLY") } } end',
      "local function refresh(widget)",
      "  local rqly = telem(widget.src.rqly)",
      '  local rqlyStr = "--"',
      "  if rqly > 0 then",
      '    rqlyStr = tostring(math.floor(rqly + 0.5)) .. "%"',
      "  end",
      "  lcd.drawText(10, 10, rqlyStr, MIDSIZE + GREEN)",
      "end",
      "return {}",
    ].join("\n");

    const cmds = parseLuaToDrawCommands(source, { ...BASE_MOCK, RQLY: 0 });
    const text = cmds.find((c) => c.kind === "text");
    assert.equal(text?.text, "--");
  });

  it("renders drawBitmap as a model placeholder", () => {
    const source = [
      "---@simulate Layout1x1 zone=0",
      "local function refresh(widget)",
      "  lcd.drawBitmap(widget.modelBmp, 20, 30)",
      "end",
      "return {}",
    ].join("\n");

    const cmds = parseLuaToDrawCommands(source, BASE_MOCK);
    assert.ok(
      cmds.some((c) => c.kind === "bitmap" && c.placeholder === "model"),
    );
  });

  it("renders drawGauge and drawAnnulus rotary gauges", () => {
    const source = [
      "---@simulate Layout1x1 zone=0",
      "local function refresh(widget)",
      "  local pct = 72",
      "  local cx, cy = 120, 140",
      "  local rOut, rIn = 44, 34",
      "  local startA, span = 135, 270",
      "  local valA = startA + span * (pct / 100)",
      "  lcd.drawGauge(20, 200, 24, 80, pct, 100, CYAN)",
      "  lcd.drawAnnulus(cx, cy, rOut, rIn, startA, startA + span, GREY)",
      "  lcd.drawAnnulus(cx, cy, rOut, rIn, startA, valA, CYAN)",
      '  lcd.drawText(cx, cy, "72%", MIDSIZE + CENTER + WHITE)',
      "end",
      "return {}",
    ].join("\n");

    const cmds = parseLuaToDrawCommands(source, BASE_MOCK);
    assert.ok(cmds.some((c) => c.kind === "gauge" && c.fill === 72));
    assert.ok(cmds.filter((c) => c.kind === "annulus").length >= 2);
    assert.ok(cmds.some((c) => c.kind === "text" && c.text === "72%"));
  });

  it("resolves LIGHTGREY clear and theme colors", () => {
    const source = [
      "---@simulate Layout1x1 zone=0",
      "local function refresh(widget)",
      "  lcd.clear(LIGHTGREY)",
      '  lcd.drawText(10, 10, "Hi", SMLSIZE + COLOR_THEME_SECONDARY1)',
      "end",
      "return {}",
    ].join("\n");

    const cmds = parseLuaToDrawCommands(source, BASE_MOCK);
    const clear = cmds.find((c) => c.kind === "clear");
    const text = cmds.find((c) => c.kind === "text");
    assert.equal(clear?.color, "#d3d3d3");
    assert.equal(text?.color, "#e0e0e8");
  });

  it("evaluates single-line if/then/end telemetry strings (strip-board style)", () => {
    const source = [
      "---@simulate Layout1x1 zone=0",
      "local function create()",
      '  return { src = { rqly = cacheSource("RQLY"), rxbt = cacheSource("RxBt"), curr = cacheSource("Curr"), trss = cacheSource("TRSS"), fm = cacheSource("FM") } }',
      "end",
      "local function refresh(widget)",
      "  local rqly = telem(widget.src.rqly)",
      "  local volts = telem(widget.src.rxbt)",
      "  local curr = telem(widget.src.curr)",
      "  local trss = telem(widget.src.trss)",
      '  local rqlyStr = "--"',
      '  if rqly > 0 then rqlyStr = tostring(math.floor(rqly + 0.5)) .. "%" end',
      '  local voltStr = "--"',
      '  if volts > 0 then voltStr = string.format("%.1fV", volts) end',
      '  local currStr = "--"',
      '  if curr ~= 0 then currStr = string.format("%.1fA", curr) end',
      '  local trssStr = "--"',
      '  if trss ~= 0 then trssStr = tostring(math.floor(trss + 0.5)) .. " dB" end',
      "  local fmRaw = telem(widget.src.fm)",
      '  local fmStr = "--"',
      '  if type(fmRaw) == "string" and fmRaw ~= "" then',
      "    fmStr = fmRaw",
      "  end",
      "  lcd.drawText(10, 24, rqlyStr, MIDSIZE + BLACK)",
      "  lcd.drawText(10, 48, voltStr, MIDSIZE + BLACK)",
      "  lcd.drawText(10, 72, currStr, MIDSIZE + BLACK)",
      "  lcd.drawText(10, 96, trssStr, MIDSIZE + BLACK)",
      "  lcd.drawText(10, 120, fmStr, MIDSIZE + BLACK)",
      "end",
      "return {}",
    ].join("\n");

    const cmds = parseLuaToDrawCommands(source, BASE_MOCK);
    const texts = cmds.filter((c) => c.kind === "text").map((c) => c.text);
    assert.ok(
      texts.some((t) => t?.includes("%")),
      `expected RQLY percent, got ${texts.join("|")}`,
    );
    assert.ok(
      texts.some((t) => t?.endsWith("V")),
      `expected voltage, got ${texts.join("|")}`,
    );
    assert.ok(
      texts.some((t) => t?.endsWith("A")),
      `expected current, got ${texts.join("|")}`,
    );
    assert.ok(
      texts.some((t) => t?.includes("dB")),
      `expected TRSS dB, got ${texts.join("|")}`,
    );
    assert.ok(
      texts.includes("Stab"),
      `expected FM mode, got ${texts.join("|")}`,
    );
  });

  it("renders lcd.RGB colors from create() for clear and card borders", () => {
    const source = [
      "---@simulate Layout1x1 zone=0",
      "local function create()",
      "  return {",
      "    C_BG = lcd.RGB(255, 255, 255),",
      "    C_CARD = lcd.RGB(255, 255, 255),",
      "    C_BORDER = lcd.RGB(200, 32, 32),",
      "  }",
      "end",
      "local function refresh(widget)",
      "  local C_BG = widget.C_BG",
      "  local C_CARD = widget.C_CARD",
      "  local C_BORDER = widget.C_BORDER",
      "  lcd.clear(C_BG)",
      "  lcd.drawFilledRectangle(0, 0, 480, 40, C_CARD)",
      "  lcd.drawRectangle(0, 0, 480, 40, C_BORDER)",
      "end",
      "return {}",
    ].join("\n");

    const cmds = parseLuaToDrawCommands(source, BASE_MOCK);
    const clear = cmds.find((c) => c.kind === "clear");
    const fill = cmds.find((c) => c.kind === "filledRect");
    const border = cmds.find((c) => c.kind === "rect");
    assert.equal(clear?.color, "#ffffff");
    assert.equal(fill?.color, "#ffffff");
    assert.equal(border?.color, "#c82020");
  });

  it("evaluates model.getTimer flight timer strings", () => {
    const source = [
      "---@simulate Layout1x1 zone=0",
      "local function refresh(widget)",
      "  local timerVal = 0",
      '  local timerStr = "--"',
      "  local tInfo = model.getTimer(0)",
      "  if tInfo and tInfo.value then timerVal = tInfo.value end",
      "  if timerVal > 0 then",
      "    local mins = math.floor(timerVal / 60)",
      "    local secs = timerVal % 60",
      '    timerStr = string.format("%02d:%02d", mins, secs)',
      "  end",
      "  lcd.drawText(10, 10, timerStr, MIDSIZE + BLACK)",
      "end",
      "return {}",
    ].join("\n");

    const cmds = parseLuaToDrawCommands(source, BASE_MOCK);
    const text = cmds.find((c) => c.kind === "text");
    assert.equal(text?.text, "02:34");
  });

  it("renders rounded card fill pattern with drawFilledCircle corners", () => {
    const source = [
      "---@simulate Layout1x1 zone=0",
      "local function refresh(widget)",
      "  local x, y, w, h = 12, 52, 100, 64",
      "  local cr = 8",
      "  local C_CARD = WHITE",
      "  lcd.drawFilledRectangle(x, y + cr, w, h - 2 * cr, C_CARD)",
      "  lcd.drawFilledRectangle(x + cr, y, w - 2 * cr, h, C_CARD)",
      "  lcd.drawFilledCircle(x + cr, y + cr, cr, C_CARD)",
      "  lcd.drawFilledCircle(x + w - cr, y + cr, cr, C_CARD)",
      "  lcd.drawFilledCircle(x + cr, y + h - cr, cr, C_CARD)",
      "  lcd.drawFilledCircle(x + w - cr, y + h - cr, cr, C_CARD)",
      "end",
      "return {}",
    ].join("\n");

    const cmds = parseLuaToDrawCommands(source, BASE_MOCK);
    const fills = cmds.filter((c) => c.kind === "filledRect");
    const corners = cmds.filter((c) => c.kind === "filledCircle");
    assert.equal(fills.length, 2);
    assert.equal(corners.length, 4);
    assert.ok(corners.every((c) => (c.r ?? 0) === 8));
  });

  it("renders BfModelDt8 strip-board with four columns and live mock values", () => {
    const cmds = parseLuaToDrawCommands(BFMODEL_DT8_SOURCE, BASE_MOCK);
    const meta = getLastPreviewParseMeta();

    const stripFills = cmds.filter(
      (c) => c.kind === "filledRect" && (c.w ?? 0) >= 100 && (c.h ?? 0) >= 50,
    );
    const stripXs = new Set(stripFills.map((c) => c.x));
    assert.ok(
      stripXs.size >= 4,
      `expected 4 strip columns, got x=${[...stripXs].join(",")}`,
    );

    const minStripY = Math.min(...stripFills.map((c) => c.y ?? 0));
    assert.ok(
      minStripY > 100,
      `strip row should be below model band, got y=${minStripY}`,
    );

    const valueTexts = cmds.filter(
      (c) =>
        c.kind === "text" &&
        c.text &&
        ![
          "VOLTAGE",
          "LINK",
          "CURRENT",
          "TIMER",
          "BATTERY",
          "USED",
          "ALTITUDE",
          "MODE",
          "WHOOP LIVE",
          "MODEL",
          "BATTERY",
        ].includes(c.text),
    );
    const positions = valueTexts.map((t) => `${t.x},${t.y}`);
    const uniquePositions = new Set(positions);
    assert.equal(
      uniquePositions.size,
      positions.length,
      `overlapping value text at ${positions.join("|")}`,
    );

    assert.ok(
      valueTexts.some((t) => t.text === "16.2V"),
      `expected voltage hero, got ${valueTexts.map((t) => t.text).join("|")}`,
    );
    assert.ok(
      valueTexts.some((t) => t.text?.includes("%") && t.text !== "--"),
      "expected battery percent",
    );
    assert.ok(
      valueTexts.some((t) => t.text?.includes("dB")),
      "expected RSSI dB in footer",
    );
    assert.ok(
      meta.skippedTextCount === 0,
      `skipped text: ${meta.warnings.join("; ")}`,
    );
  });
});
