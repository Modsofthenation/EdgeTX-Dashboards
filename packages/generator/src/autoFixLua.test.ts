import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { autoFixLua } from "./autoFixLua.ts";
import {
  validateFilledRectOpacity,
  validateLcdDrawLineCalls,
  validateMathDegUsage,
  validateRoundedPanelArcCalls,
  validateColorConstants,
  validateDrawAnnulusRadiusOrder,
} from "./lcdApiValidate.ts";

describe("autoFixLua", () => {
  it("inserts SOLID when drawLine uses color as 5th arg", () => {
    const src =
      "lcd.drawLine(0, 0, 10, 0, widget.C_BORDER)\nlcd.drawLine(1, 2, 3, 4, RED)\n";
    const { source, applied } = autoFixLua(src);
    assert.ok(applied.some((a) => /SOLID/.test(a)));
    assert.match(source, /drawLine\(0, 0, 10, 0, SOLID, widget\.C_BORDER\)/);
    assert.match(source, /drawLine\(1, 2, 3, 4, SOLID, RED\)/);
    assert.equal(validateLcdDrawLineCalls(source).length, 0);
  });

  it("rewrites preview-only color aliases", () => {
    const src = 'lcd.drawText(0, 0, "x", SMLSIZE + LIME)\nlocal c = GRAY\n';
    const { source, applied } = autoFixLua(src);
    assert.ok(applied.some((a) => /LIME/.test(a)));
    assert.ok(applied.some((a) => /GRAY/.test(a)));
    assert.equal(validateColorConstants(source).length, 0);
  });

  it("fixes top-left math-style drawArc angles", () => {
    const src = `lcd.drawFilledCircle(x + cr, y + cr, cr, GREY)
lcd.drawArc(x + cr, y + cr, cr, 180, 270, GREY)
`;
    const { source, applied } = autoFixLua(src);
    assert.ok(applied.some((a) => /270,360/.test(a)));
    assert.match(source, /270, 360/);
    assert.equal(validateRoundedPanelArcCalls(source).length, 0);
  });

  it("swaps reversed annulus radii", () => {
    const src = "lcd.drawAnnulus(cx, cy, 40, 28, 0, 270, GREEN)\n";
    const { source, applied } = autoFixLua(src);
    assert.ok(applied.some((a) => /annulus/i.test(a)));
    assert.match(source, /drawAnnulus\(cx, cy, 28, 40,/);
    assert.equal(validateDrawAnnulusRadiusOrder(source).length, 0);
  });

  it("clamps drawFilledRectangle opacity from 0–255 to 0–15", () => {
    const src = "lcd.drawFilledRectangle(0, 0, 100, 50, BLACK, 168)\n";
    const { source, applied } = autoFixLua(src);
    assert.ok(applied.some((a) => /opacity/i.test(a)));
    assert.match(source, /BLACK, 10\)/);
    assert.equal(validateFilledRectOpacity(source).length, 0);
  });

  it("rewrites math.deg to floor rounding", () => {
    const src = "local a = math.deg(rad)\n";
    const { source, applied } = autoFixLua(src);
    assert.ok(applied.some((a) => /math\.deg/.test(a)));
    assert.match(source, /math\.floor\(\(rad\) \+ 0\.5\)/);
    assert.equal(validateMathDegUsage(source).length, 0);
  });

  it("rewrites /MODELS/ bitmap paths to /IMAGES/", () => {
    const src = 'local MODEL_IMG = "/MODELS/model.png"\n';
    const { source, applied } = autoFixLua(src);
    assert.ok(applied.some((a) => /IMAGES/.test(a)));
    assert.match(source, /\/IMAGES\/model\.png/);
  });

  it("normalizes Bitmap.getSize(path, handle) to handle only", () => {
    const src =
      "local modelBmp = Bitmap.open(MODEL_IMG)\nlocal w, h = Bitmap.getSize(MODEL_IMG, modelBmp)\n";
    const { source, applied } = autoFixLua(src);
    assert.ok(applied.some((a) => /getSize/.test(a)));
    assert.match(source, /Bitmap\.getSize\(modelBmp\)/);
  });

  it("is idempotent on clean source", () => {
    const src =
      "lcd.drawLine(0, 0, 10, 0, SOLID, GREY)\nlcd.drawText(0, 0, \"ok\", SMLSIZE + WHITE)\n";
    const once = autoFixLua(src);
    const twice = autoFixLua(once.source);
    assert.equal(twice.applied.length, 0);
    assert.equal(twice.source, once.source);
  });
});

describe("validateFilledRectOpacity", () => {
  it("rejects opacity > 15", () => {
    const issues = validateFilledRectOpacity(
      "lcd.drawFilledRectangle(0, 0, 10, 10, BLACK, 200)",
    );
    assert.equal(issues.length, 1);
    assert.match(issues[0].message, /0–15/);
  });

  it("accepts opacity 0–15", () => {
    assert.deepEqual(
      validateFilledRectOpacity(
        "lcd.drawFilledRectangle(0, 0, 10, 10, BLACK, 10)",
      ),
      [],
    );
  });
});

describe("validateMathDegUsage", () => {
  it("rejects math.deg", () => {
    assert.equal(validateMathDegUsage("local a = math.deg(x)").length, 1);
  });
});
