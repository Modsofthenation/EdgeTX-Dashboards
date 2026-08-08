import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  assertBenchBudget,
  assertFasterThan,
  assertNoRegression,
  clearStaticParseCache,
  formatBenchStats,
  measureSync,
  parseLuaToDrawCommands,
  parseLuaToDrawCommandsStatic,
} from "./perfImports.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../../..");
const baselinePath = join(here, "../baselines/layout-verify.json");
const gold = readFileSync(
  join(repoRoot, "examples/tx15-minimal-dashboard.lua"),
  "utf8",
);

describe("perf: layout interpret", () => {
  it("parseLuaToDrawCommands stays within budget and baseline", () => {
    clearStaticParseCache();
    const stats = measureSync(
      "parseLuaToDrawCommands(gold)",
      () => {
        clearStaticParseCache();
        parseLuaToDrawCommands(gold);
      },
      { iterations: 30, warmup: 5 },
    );
    // eslint-disable-next-line no-console
    console.log(formatBenchStats(stats));
    assertBenchBudget(stats, { maxMeanMs: 80, maxP95Ms: 150 });
    assertNoRegression(stats, {
      baselinePath,
      suiteKey: "parseLuaToDrawCommands.gold",
    });
  });

  it("static parse cache returns same object and speeds up re-parse", () => {
    clearStaticParseCache();
    const cold = measureSync(
      "static-parse-cold",
      () => {
        clearStaticParseCache();
        parseLuaToDrawCommandsStatic(gold);
      },
      { iterations: 20, warmup: 3 },
    );
    clearStaticParseCache();
    parseLuaToDrawCommandsStatic(gold);
    const hot = measureSync(
      "static-parse-hot",
      () => {
        const hit = parseLuaToDrawCommandsStatic(gold);
        assert.ok(hit);
      },
      { iterations: 40, warmup: 5 },
    );
    // eslint-disable-next-line no-console
    console.log(formatBenchStats(cold));
    // eslint-disable-next-line no-console
    console.log(formatBenchStats(hot));
    assert.equal(
      parseLuaToDrawCommandsStatic(gold),
      parseLuaToDrawCommandsStatic(gold),
    );
    assertFasterThan(hot, cold, 2);
    assertNoRegression(hot, {
      baselinePath,
      suiteKey: "staticParse.hot",
    });
  });
});
