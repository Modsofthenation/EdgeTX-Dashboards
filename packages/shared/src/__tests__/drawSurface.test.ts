import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractRefreshBody } from "../drawSurface.js";

describe("extractRefreshBody", () => {
  it("extracts full body with nested if/end blocks", () => {
    const source = [
      "local function refresh(widget)",
      "  lcd.clear(BLACK)",
      "  if widget.options.ShowLink == 1 then",
      "    if fillW > 0 then",
      '      lcd.drawText(1, 2, "inner")',
      "    end",
      '  lcd.drawText(3, 4, "after-if")',
      "end",
      "return {}",
    ].join("\n");

    const body = extractRefreshBody(source);
    assert.ok(body.includes('lcd.drawText(3, 4, "after-if")'));
    assert.ok(body.includes('lcd.drawText(1, 2, "inner")'));
  });
});
