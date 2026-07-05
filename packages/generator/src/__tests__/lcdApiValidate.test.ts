import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateBitmapGetSizeCalls, validateBarsBlockHeightSync, validateDrawAnnulusRadiusOrder, validateGaugeSatelliteBudget, validateGaugeStripLayoutPlanning, validateGlobalGetSizeCalls, validateLcdDrawLineCalls, validateMainHLiteralClamp, validateModelBitmapPath, validateRoundedPanelArcCalls, validateUnitSuffixPositioning } from "../lcdApiValidate.js";

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

describe("validateDrawAnnulusRadiusOrder", () => {
  it("rejects rOut, rIn argument order", () => {
    const source = `local function refresh()
  lcd.drawAnnulus(cx, cy, rOut, rIn, 135, 360, GREY)
end`;
    const issues = validateDrawAnnulusRadiusOrder(source);
    assert.equal(issues.length, 1);
    assert.match(issues[0].message, /rIn, rOut/);
  });

  it("accepts rIn, rOut argument order", () => {
    const source = `local function refresh()
  lcd.drawAnnulus(cx, cy, rIn, rOut, 135, 360, GREY)
end`;
    assert.deepEqual(validateDrawAnnulusRadiusOrder(source), []);
  });

  it("rejects numeric radii when first > second", () => {
    const source = `lcd.drawAnnulus(120, 140, 54, 42, 0, 270, GREY)`;
    const issues = validateDrawAnnulusRadiusOrder(source);
    assert.equal(issues.length, 1);
  });
});

describe("validateModelBitmapPath", () => {
  it("rejects hardcoded /MODELS/*.png paths", () => {
    const source = `local MODEL_IMG = "/MODELS/model.png"
local function create()
  return { modelBmp = Bitmap.open(MODEL_IMG) }
end`;
    const issues = validateModelBitmapPath(source);
    assert.equal(issues.length, 1);
    assert.match(issues[0].message, /\/IMAGES\//);
  });

  it("accepts model.getInfo bitmap path", () => {
    const source = `local function loadModelBitmap()
  local info = model.getInfo()
  return Bitmap.open("/IMAGES/" .. info.bitmap)
end`;
    assert.deepEqual(validateModelBitmapPath(source), []);
  });
});

describe("validateMainHLiteralClamp", () => {
  it("rejects literal mainH floor with gauge+strip", () => {
    const source = `local stripY = 200
local function refresh()
  if mainH < 72 then
    mainH = 72
  end
  lcd.drawAnnulus(0, 0, 40, 52, 0, 270, GREY)
end`;
    const issues = validateMainHLiteralClamp(source);
    assert.equal(issues.length, 1);
  });

  it("accepts gaugeZoneH layout without literal clamp", () => {
    const source = `local function gaugeZoneH(rOut) return rOut * 2 end
lcd.drawAnnulus(0, 0, 40, 52, 0, 270, GREY)
local stripY = 200`;
    assert.deepEqual(validateMainHLiteralClamp(source), []);
  });
});

describe("validateGaugeSatelliteBudget", () => {
  it("rejects gaugeCy+rOut satellites without budget helper", () => {
    const source = `local yAmpVal = gaugeCy + rOut + 6
lcd.drawAnnulus(cx, cy, 40, 52, 0, 270, GREY)`;
    const issues = validateGaugeSatelliteBudget(source);
    assert.equal(issues.length, 1);
  });

  it("accepts satelliteBelowH budget", () => {
    const source = `local function satelliteBelowH() return 50 end
local yAmpVal = gaugeCy + rOut + 6
lcd.drawAnnulus(cx, cy, 40, 52, 0, 270, GREY)`;
    assert.deepEqual(validateGaugeSatelliteBudget(source), []);
  });
});

describe("validateGaugeStripLayoutPlanning", () => {
  it("rejects annulus+strip without planner", () => {
    const source = `local stripY = 200
lcd.drawAnnulus(0, 0, 40, 52, 0, 270, GREY)`;
    const issues = validateGaugeStripLayoutPlanning(source);
    assert.equal(issues.length, 1);
  });

  it("accepts mainBottom planner", () => {
    const source = `local mainBottom = stripY - pad
local stripY = 200
lcd.drawAnnulus(0, 0, 40, 52, 0, 270, GREY)`;
    assert.deepEqual(validateGaugeStripLayoutPlanning(source), []);
  });
});

describe("validateBarsBlockHeightSync", () => {
  it("rejects barsBlockH that omits barsPctY", () => {
    const source = `local barsBlockH = LH.SML + LH.GAP + barH + LH.SEC
local barsPctY = trackY + barH + LH.GAP
lcd.drawText(0, barsPctY, "91%", SMLSIZE)`;
    const issues = validateBarsBlockHeightSync(source);
    assert.equal(issues.length, 1);
  });

  it("accepts barsBlockH derived from barsPctY", () => {
    const source = `local barsPctY = trackY + barH + LH.GAP
local barsBlockH = barsPctY + barsPctRowH() - barsY`;
    assert.deepEqual(validateBarsBlockHeightSync(source), []);
  });
});

describe("validateUnitSuffixPositioning", () => {
  it("rejects #str*charW unit offset math", () => {
    const source = `local x = valX + math.floor(#ampsStr * 9) + 4`;
    const issues = validateUnitSuffixPositioning(source);
    assert.equal(issues.length, 1);
    assert.match(issues[0].message, /fixed vertical rows/);
  });

  it("accepts fixed stride row layout", () => {
    const source = `local yPowerUnit = yPowerVal + LH.MID + LH.GAP
lcd.drawText(valX, yPowerUnit, "A", SMLSIZE + LIGHTGREY)`;
    assert.deepEqual(validateUnitSuffixPositioning(source), []);
  });
});
