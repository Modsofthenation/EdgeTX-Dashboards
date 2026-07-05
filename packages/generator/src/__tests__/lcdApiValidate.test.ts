import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateLcdDrawLineCalls } from "../lcdApiValidate.js";

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
