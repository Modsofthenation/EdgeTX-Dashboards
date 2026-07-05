import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildCreativeBrief,
  deriveVariationSeed,
  hashString,
  shouldBumpRunIndexForRefine,
} from "../designVariation.js";
import { suggestLayoutArchetype } from "../layoutArchetype.js";

describe("deriveVariationSeed", () => {
  it("returns different seeds for different run indexes", () => {
    const s0 = deriveVariationSeed("session-a", 0);
    const s1 = deriveVariationSeed("session-a", 1);
    assert.notEqual(s0, s1);
  });

  it("returns stable seed for same session and run index", () => {
    assert.equal(deriveVariationSeed("session-b", 2), deriveVariationSeed("session-b", 2));
  });
});

describe("buildCreativeBrief", () => {
  it("produces different palettes for different seeds", () => {
    const archetype = suggestLayoutArchetype("battery dashboard", "betaflight", 0);
    const a = buildCreativeBrief(1, archetype, "betaflight", "battery dashboard");
    const b = buildCreativeBrief(99, archetype, "betaflight", "battery dashboard");
    assert.notEqual(a.palette.id, b.palette.id);
    assert.match(a.markdown, /Creative brief/i);
  });
});

describe("hashString", () => {
  it("changes when seed suffix changes", () => {
    const a = hashString("prompt:0");
    const b = hashString("prompt:1");
    assert.notEqual(a, b);
  });
});

describe("shouldBumpRunIndexForRefine", () => {
  it("detects layout change keywords", () => {
    assert.equal(shouldBumpRunIndexForRefine("try a different layout please"), true);
    assert.equal(shouldBumpRunIndexForRefine("fix the typo in voltage label"), false);
  });
});

describe("seed-based archetype variety", () => {
  it("same prompt with different seeds can pick different archetypes", () => {
    const prompt = "show my telemetry nicely";
    const ids = new Set(
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((seed) =>
        suggestLayoutArchetype(prompt, "betaflight", seed).id
      )
    );
    assert.ok(ids.size >= 2, `expected variety, got only ${[...ids].join(",")}`);
  });
});
