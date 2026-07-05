import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { wantsRoundedCorners, buildRoundedCornersDirective } from "../roundedCorners.js";
import { buildCreativeBrief } from "../designVariation.js";
import { suggestLayoutArchetype } from "../layoutArchetype.js";

describe("wantsRoundedCorners", () => {
  it("detects rounded corner requests", () => {
    assert.equal(wantsRoundedCorners("grid blocks with rounded corners"), true);
    assert.equal(wantsRoundedCorners("use rounded cards for each metric"), true);
    assert.equal(wantsRoundedCorners("plain battery dashboard"), false);
  });
});

describe("buildRoundedCornersDirective", () => {
  it("wraps guide markdown", () => {
    const out = buildRoundedCornersDirective("Use drawFilledCircle.");
    assert.match(out, /Rounded card panels/i);
    assert.match(out, /drawFilledCircle/);
  });
});

describe("buildCreativeBrief rounded corners", () => {
  it("includes rounded panel directive when prompt asks for rounded grid", () => {
    const archetype = suggestLayoutArchetype("strip board rounded grid", "betaflight", 0);
    const brief = buildCreativeBrief(1, archetype, "betaflight", "strip board with rounded corners on each block");
    assert.match(brief.markdown, /Rounded card panels/i);
    assert.match(brief.markdown, /drawFilledCircle/i);
  });
});
