import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { suggestLayoutArchetype } from "./layoutArchetype.ts";
import { detectVisualStyle } from "./visualStyle.ts";

describe("suggestLayoutArchetype", () => {
  it("routes logger prompts to flight-logger-suite", () => {
    const hint = suggestLayoutArchetype("add a flight log viewer", "betaflight");
    assert.equal(hint.id, "flight-logger-suite");
  });

  it("routes rotorflight heli keywords to heli board", () => {
    const hint = suggestLayoutArchetype("headspeed and motor temps", "rotorflight");
    assert.equal(hint.id, "heli-rotorflight");
  });

  it("does not route heli keywords to heli board when protocol is betaflight", () => {
    const hint = suggestLayoutArchetype("headspeed and motor temps", "betaflight");
    assert.notEqual(hint.id, "heli-rotorflight");
  });

  it("does not force heli board for generic rotorflight prompts", () => {
    const hint = suggestLayoutArchetype("show battery and link quality", "rotorflight", 0);
    assert.notEqual(hint.id, "heli-rotorflight");
  });

  it("routes vibrant heli away from default heli clone", () => {
    const hint = suggestLayoutArchetype("vibrant colorful heli dashboard", "rotorflight");
    assert.notEqual(hint.id, "heli-rotorflight");
    assert.match(hint.layoutNotes, /vibrant accent colors/i);
  });

  it("varies fallback archetype by seed", () => {
    const a = suggestLayoutArchetype("generic dashboard", "betaflight", 0).id;
    const b = suggestLayoutArchetype("generic dashboard", "betaflight", 3).id;
    assert.notEqual(a, b);
  });
});

describe("detectVisualStyle", () => {
  it("returns prompt notes for colorful requests", () => {
    const style = detectVisualStyle("make it vibrant and colorful");
    assert.equal(style.vibrant, true);
    assert.match(style.promptNotes, /mandatory/i);
  });

  it("returns automatic palette notes for plain prompts", () => {
    const style = detectVisualStyle("simple battery widget", 2);
    assert.equal(style.colorEmphasis, true);
    assert.match(style.promptNotes, /automatic variety/i);
  });
});
