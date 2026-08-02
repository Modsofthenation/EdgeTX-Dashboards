import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  assertBenchBudget,
  assertNoRegression,
  createFrameThrottle,
  formatBenchStats,
  FRAME_MIN_INTERVAL_MS,
  measureSync,
  unifiedDiff,
} from "./perfImports.ts";

const here = dirname(fileURLToPath(import.meta.url));
const baselinePath = join(here, "../baselines/web.json");

describe("perf: web hotspots", () => {
  it("frameThrottle emits ~30fps from 60 pushes (deterministic)", () => {
    const emitted: number[] = [];
    let now = 0;
    const timers = new Map<ReturnType<typeof setTimeout>, () => void>();
    let nextId = 1;
    const throttle = createFrameThrottle<number>(
      (frame) => emitted.push(frame),
      FRAME_MIN_INTERVAL_MS,
      {
        now: () => now,
        setTimeout: (fn) => {
          const id = nextId++ as unknown as ReturnType<typeof setTimeout>;
          timers.set(id, fn);
          return id;
        },
        clearTimeout: (id) => {
          timers.delete(id);
        },
      },
    );

    for (let i = 0; i < 60; i++) {
      now = i * (1000 / 60);
      throttle.push(i);
    }
    // Trailing pending frame.
    now = 1000;
    for (const fn of timers.values()) fn();
    timers.clear();

    // ~30Hz from 60Hz input over 1s → about 30–32 emissions.
    assert.ok(
      emitted.length >= 28 && emitted.length <= 35,
      `expected ~30 frames, got ${emitted.length}`,
    );
    assert.equal(emitted[emitted.length - 1], 59);
  });

  it("unifiedDiff large inputs stay bounded in time", () => {
    const before = Array.from({ length: 800 }, (_, i) => `line-${i}-a`).join(
      "\n",
    );
    const after = Array.from({ length: 800 }, (_, i) => `line-${i}-b`).join(
      "\n",
    );
    const stats = measureSync(
      "unifiedDiff(800×800 capped)",
      () => {
        unifiedDiff(before, after, {
          maxLines: 120,
          maxMatrixCells: 250_000,
        });
      },
      { iterations: 8, warmup: 2 },
    );
    // eslint-disable-next-line no-console
    console.log(formatBenchStats(stats));
    assertBenchBudget(stats, { maxMeanMs: 100, maxP95Ms: 200 });
    assertNoRegression(stats, {
      baselinePath,
      suiteKey: "unifiedDiff.800capped",
    });
  });
});
