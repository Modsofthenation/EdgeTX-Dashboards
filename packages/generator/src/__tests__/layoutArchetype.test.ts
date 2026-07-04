import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { suggestLayoutArchetype } from "../layoutArchetype.js";
import { detectVisualStyle } from "../visualStyle.js";

describe("suggestLayoutArchetype", () => {
  it("routes logger prompts to flight-logger-suite", () => {
    const hint = suggestLayoutArchetype("add a flight log viewer", "betaflight");
    assert.equal(hint.id, "flight-logger-suite");
  });

  it("routes rotorflight heli to heli board by default", () => {
    const hint = suggestLayoutArchetype("headspeed and motor temps", "rotorflight");
    assert.equal(hint.id, "heli-rotorflight");
  });

  it("routes vibrant heli away from default heli clone", () => {
    const hint = suggestLayoutArchetype("vibrant colorful heli dashboard", "rotorflight");
    assert.notEqual(hint.id, "heli-rotorflight");
    assert.match(hint.layoutNotes, /vibrant accent colors/i);
  });
});

describe("detectVisualStyle", () => {
  it("returns prompt notes for colorful requests", () => {
    const style = detectVisualStyle("make it vibrant and colorful");
    assert.equal(style.vibrant, true);
    assert.match(style.promptNotes, /mandatory/i);
  });

  it("returns empty notes for plain prompts", () => {
    const style = detectVisualStyle("simple battery widget");
    assert.equal(style.colorEmphasis, false);
    assert.equal(style.promptNotes, "");
  });
});
