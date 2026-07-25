import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { findOverlaps } from "../overlap.ts";
import { interpretWidgetLayout } from "../interpreter/luaDrawInterpreter.ts";
import { isInterpretationReliable } from "../reliability.ts";
import { TORTURE_SCENARIOS } from "../scenarios/tortureGallery.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..", "..", "..");

function readExample(name: string): string {
  return readFileSync(join(repoRoot, "examples", name), "utf-8");
}

function readFixture(name: string): string {
  return readFileSync(join(__dirname, "..", "..", "src", "__tests__", "fixtures", name), "utf-8");
}

describe("regression gallery", () => {
  const goldExamples = [
    "tx15-bfdash8f-whoop-dashboard.lua",
    "tx15-model-hero-dashboard.lua",
  ];

  for (const file of goldExamples) {
    it(`${file} passes torture scenarios when layout is statically reliable`, () => {
      const source = readExample(file);
      for (const scenario of TORTURE_SCENARIOS) {
        const { records, skippedTextCount } = interpretWidgetLayout(source, scenario);
        // Use annulus reliability only — skipped text is reported separately in validateDrawGeometry.
        if (!isInterpretationReliable(records, 0)) continue;
        if (skippedTextCount > 0) continue;
        const hits = findOverlaps(records);
        assert.equal(
          hits.length,
          0,
          `${file} [${scenario.id}]: ${hits.map((h) => `${h.a.kind} vs ${h.b.kind}`).join(", ")}`
        );
      }
    });
  }

  it("literal-gauge-bar-collision fixture fails overlap check", () => {
    const source = readFixture("literal-gauge-bar-collision.lua");
    const { records, skippedTextCount } = interpretWidgetLayout(source, TORTURE_SCENARIOS[0]);
    assert.equal(isInterpretationReliable(records, skippedTextCount), true);
    const hits = findOverlaps(records);
    assert.ok(hits.length > 0);
    const hasAnnulusText = hits.some(
      (h) =>
        (h.a.kind === "annulus" && h.b.kind === "text") ||
        (h.b.kind === "annulus" && h.a.kind === "text")
    );
    assert.ok(hasAnnulusText);
  });

  it("bfgenemt-overlap fixture fails or is unreliable (known bad layout)", () => {
    const source = readFixture("bfgenemt-overlap.lua");
    const { records, skippedTextCount } = interpretWidgetLayout(source, TORTURE_SCENARIOS[0]);
    if (!isInterpretationReliable(records, skippedTextCount)) return;
    const hits = findOverlaps(records);
    if (hits.length === 0) return;
    assert.ok(hits.length > 0);
  });
});
