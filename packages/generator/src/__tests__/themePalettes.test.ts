import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pickDashboardPaletteForPrompt } from "../themePalettes.js";

describe("pickDashboardPaletteForPrompt", () => {
  it("selects light surface for white background requests", () => {
    const p = pickDashboardPaletteForPrompt(3, "make the background white and clean");
    assert.equal(p.id, "light-surface");
  });

  it("returns valid palette for generic prompts", () => {
    const p = pickDashboardPaletteForPrompt(7, "betaflight battery dashboard");
    assert.ok(p.id.length > 0);
    assert.equal(p.accents.length, 3);
  });
});
