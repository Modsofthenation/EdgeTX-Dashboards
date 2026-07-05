import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateBitmapGetSizeCalls, validateGlobalGetSizeCalls, validateLcdDrawLineCalls, validateRoundedPanelArcCalls } from "../lcdApiValidate.js";

const REFRESH_PREFIX = `local function refresh(widget)
  local cr = 8
  `;

const REFRESH_SUFFIX = `
end
return { name = "Test", create = function() return {} end, refresh = refresh }
`;

describe("validateLcdDrawLineCalls", () => {
  it("accepts drawLine with SOLID and color flags", () => {
    const source =
      REFRESH_PREFIX +
      "lcd.drawLine(0, 0, 10, 0, SOLID, widget.C_BORDER)\n" +
      REFRESH_SUFFIX;
    assert.deepEqual(validateLcdDrawLineCalls(source), []);
  });

  it("rejects color as 5th argument (WASM runtime error)", () => {
    const source =
      REFRESH_PREFIX +
      "lcd.drawLine(linkX + cr, barsY, linkX + linkW - cr, barsY, widget.C_BORDER)\n" +
      REFRESH_SUFFIX;
    const issues = validateLcdDrawLineCalls(source);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].severity, "error");
    assert.match(issues[0].message, /SOLID or DOTTED/);
  });

  it("rejects named color constant as 5th argument", () => {
    const source = REFRESH_PREFIX + "lcd.drawLine(1, 2, 3, 4, CYAN)\n" + REFRESH_SUFFIX;
    assert.equal(validateLcdDrawLineCalls(source).length, 1);
  });
});

describe("validateBitmapGetSizeCalls", () => {
  it("accepts bitmap handle as sole argument", () => {
    const source = `local function create()
  local modelBmp = Bitmap.open(MODEL_IMG)
  local bmpW, bmpH = Bitmap.getSize(modelBmp)
  return { modelBmp = modelBmp }
end`;
    assert.deepEqual(validateBitmapGetSizeCalls(source), []);
  });

  it("rejects path string as first argument (radio create() crash)", () => {
    const source = `local function create()
  local modelBmp = Bitmap.open(MODEL_IMG)
  local bmpW, bmpH = Bitmap.getSize(MODEL_IMG, modelBmp)
  return {}
end`;
    const issues = validateBitmapGetSizeCalls(source);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].severity, "error");
    assert.match(issues[0].message, /bitmap handle/);
  });
});

describe("validateRoundedPanelArcCalls", () => {
  it("rejects math-style top-left corner arc angles", () => {
    const source = `local function refresh()
  lcd.drawFilledCircle(x + cr, y + cr, cr, GREY)
  lcd.drawArc(x + cr, y + cr, cr, 180, 270, CYAN)
end`;
    const issues = validateRoundedPanelArcCalls(source);
    assert.equal(issues.length, 1);
    assert.match(issues[0].message, /270, 360/);
  });

  it("accepts EdgeTX top-left corner arc angles", () => {
    const source = `local function refresh()
  lcd.drawFilledCircle(x + cr, y + cr, cr, GREY)
  lcd.drawArc(x + cr, y + cr, cr, 270, 360, CYAN)
end`;
    assert.deepEqual(validateRoundedPanelArcCalls(source), []);
  });
});

describe("validateGlobalGetSizeCalls", () => {
  it("rejects bare getSize with path string", () => {
    const source = `local function create()
  local modelBmp = Bitmap.open(MODEL_IMG)
  local w, h = getSize(MODEL_IMG)
  return {}
end`;
    const issues = validateGlobalGetSizeCalls(source);
    assert.equal(issues.length, 1);
    assert.match(issues[0].message, /bitmap handle/);
  });

  it("ignores Bitmap.getSize (handled separately)", () => {
    const source = `local w, h = Bitmap.getSize(modelBmp)`;
    assert.deepEqual(validateGlobalGetSizeCalls(source), []);
  });
});
