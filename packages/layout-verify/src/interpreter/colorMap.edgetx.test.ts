import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { COLOR_MAP, THEME_COLOR_MAP } from "./luaDrawInterpreter.ts";

/**
 * Fixed + theme colors from EdgeTX radio/src/gui/colorlcd/colors.cpp
 * (lcdColorTable). Keep approximate preview aligned with WASM/radio.
 */
describe("EdgeTX COLOR_MAP firmware alignment", () => {
  it("matches EdgeTX fixed color constants", () => {
    assert.equal(COLOR_MAP.BLACK, "#000000");
    assert.equal(COLOR_MAP.WHITE, "#ffffff");
    assert.equal(COLOR_MAP.LIGHTGREY, "#c0c0c0");
    assert.equal(COLOR_MAP.GREY, "#606060");
    assert.equal(COLOR_MAP.DARKGREY, "#404040");
    assert.equal(COLOR_MAP.RED, "#ff0000");
    assert.equal(COLOR_MAP.DARKRED, "#a00000");
    assert.equal(COLOR_MAP.LIGHTRED, "#ff9999");
    assert.equal(COLOR_MAP.GREEN, "#00ff00");
    assert.equal(COLOR_MAP.DARKGREEN, "#00a000");
    assert.equal(COLOR_MAP.BRIGHTGREEN, "#00b43c");
    assert.equal(COLOR_MAP.BLUE, "#0000ff");
    assert.equal(COLOR_MAP.DARKBLUE, "#0000a0");
    assert.equal(COLOR_MAP.CYAN, "#00ffff");
    assert.equal(COLOR_MAP.YELLOW, "#ffff00");
    assert.equal(COLOR_MAP.ORANGE, "#e5641e");
    assert.equal(COLOR_MAP.MAGENTA, "#c000c0");
  });

  it("matches EdgeTX default theme constants", () => {
    assert.equal(THEME_COLOR_MAP.COLOR_THEME_PRIMARY1, "#000000");
    assert.equal(THEME_COLOR_MAP.COLOR_THEME_PRIMARY2, "#ffffff");
    assert.equal(THEME_COLOR_MAP.COLOR_THEME_PRIMARY3, "#0c3f66");
    assert.equal(THEME_COLOR_MAP.COLOR_THEME_SECONDARY1, "#125e99");
    assert.equal(THEME_COLOR_MAP.COLOR_THEME_FOCUS, "#14a1e5");
    assert.equal(THEME_COLOR_MAP.COLOR_THEME_WARNING, "#e00000");
    assert.equal(THEME_COLOR_MAP.CUSTOM_COLOR, "#aa5500");
  });
});
