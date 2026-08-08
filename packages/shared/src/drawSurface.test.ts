import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractRefreshBody, findRefreshBodyEndIndex } from "./drawSurface.ts";

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

  it("preserves indentation on the first body line", () => {
    const source = [
      "local function refresh(widget)",
      "  lcd.clear(BLACK)",
      '  lcd.drawText(4, 4, "hi")',
      "end",
    ].join("\n");

    const body = extractRefreshBody(source);
    assert.equal(body.startsWith("  lcd.clear"), true);
  });

  it("extracts refresh = function(...) form", () => {
    const source = [
      "refresh = function(widget)",
      "  lcd.clear(BLACK)",
      '  lcd.drawText(4, 4, "hi")',
      "end",
      "return { refresh = refresh }",
    ].join("\n");

    const body = extractRefreshBody(source);
    assert.ok(body.includes("lcd.clear(BLACK)"));
    assert.ok(body.includes('lcd.drawText(4, 4, "hi")'));
    const endIdx = findRefreshBodyEndIndex(source);
    assert.ok(endIdx > 0);
    assert.equal(source.slice(endIdx, endIdx + 3), "end");
  });
});
