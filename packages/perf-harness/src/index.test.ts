import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  assertBenchBudget,
  assertFasterThan,
  assertNoRegression,
  measureSync,
  loadBaselineFile,
} from "./index.ts";

describe("perf-harness", () => {
  it("measureSync returns stable shape", () => {
    const stats = measureSync(
      "noop",
      () => {
        /* burn a tiny bit */
        let x = 0;
        for (let i = 0; i < 100; i++) x += i;
        void x;
      },
      { iterations: 10, warmup: 2 },
    );
    assert.equal(stats.name, "noop");
    assert.equal(stats.iterations, 10);
    assert.ok(stats.meanMs >= 0);
    assert.ok(stats.p95Ms >= stats.p50Ms);
    assert.ok(stats.opsPerSec > 0);
  });

  it("assertBenchBudget fails over ceiling", () => {
    const stats = measureSync("slowish", () => {}, {
      iterations: 5,
      warmup: 0,
    });
    assert.throws(
      () => assertBenchBudget(stats, { maxMeanMs: -1 }),
      /perf budget failed/,
    );
  });

  it("assertFasterThan compares means", () => {
    const fast = measureSync("fast", () => {}, { iterations: 5, warmup: 0 });
    const slow = {
      ...fast,
      name: "slow",
      meanMs: fast.meanMs * 3 + 1,
    };
    assertFasterThan(fast, slow, 2);
    assert.throws(() => assertFasterThan(slow, fast, 2), /faster/);
  });

  it("assertNoRegression seeds then enforces baselines", () => {
    const dir = mkdtempSync(join(tmpdir(), "perf-base-"));
    const path = join(dir, "base.json");
    try {
      const stats = measureSync("seed", () => {}, { iterations: 8, warmup: 1 });
      delete process.env.UPDATE_PERF_BASELINES;
      assertNoRegression(stats, {
        baselinePath: path,
        suiteKey: "seed",
        maxMeanRegression: 1,
      });
      const file = loadBaselineFile(path);
      assert.ok(file.suites.seed);

      assertNoRegression(
        { ...stats, meanMs: stats.meanMs * 0.9 },
        { baselinePath: path, suiteKey: "seed", maxMeanRegression: 0.5 },
      );

      assert.throws(
        () =>
          assertNoRegression(
            { ...stats, meanMs: stats.meanMs * 10 + 5 },
            { baselinePath: path, suiteKey: "seed", maxMeanRegression: 0.5 },
          ),
        /perf regression/,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
