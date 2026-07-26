import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PREVIEW_ONLY_COLOR_NAMES,
  RADIO_SAFE_COLOR_NAMES,
  remapPreviewOnlyColorLiterals,
  toRadioSafeColor,
} from "./colors.ts";

describe("radio-safe color picker helpers", () => {
  it("excludes preview-only names from the picker list", () => {
    for (const name of PREVIEW_ONLY_COLOR_NAMES) {
      assert.equal(RADIO_SAFE_COLOR_NAMES.includes(name as never), false);
    }
    assert.ok(RADIO_SAFE_COLOR_NAMES.includes("BRIGHTGREEN"));
    assert.ok(RADIO_SAFE_COLOR_NAMES.includes("WHITE"));
  });

  it("coerces CYAN to BRIGHTGREEN for picker values", () => {
    assert.equal(toRadioSafeColor("CYAN"), "BRIGHTGREEN");
    assert.equal(toRadioSafeColor("LIME"), "BRIGHTGREEN");
    assert.equal(toRadioSafeColor("MAGENTA"), "ORANGE");
    assert.equal(toRadioSafeColor("GREEN"), "GREEN");
  });

  it("rewrites CYAN literals in Lua source", () => {
    const { source, applied } = remapPreviewOnlyColorLiterals(
      'lcd.drawText(0, 0, "x", MIDSIZE + CYAN)\n',
    );
    assert.ok(applied.some((a) => a.startsWith("CYAN→")));
    assert.match(source, /BRIGHTGREEN/);
    assert.doesNotMatch(source, /\bCYAN\b/);
  });

  it("prefers widget.C_ACCENT when create() already defines it", () => {
    const { source } = remapPreviewOnlyColorLiterals(
      "local function create()\n  return { C_ACCENT = lcd.RGB(0, 210, 255) }\nend\nlcd.drawText(0, 0, 'x', CYAN)\n",
    );
    assert.match(source, /widget\.C_ACCENT/);
    assert.doesNotMatch(source, /\bCYAN\b/);
  });
});
