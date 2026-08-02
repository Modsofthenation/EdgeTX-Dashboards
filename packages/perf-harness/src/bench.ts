/**
 * Lightweight sync micro-benchmark harness for Node tests.
 * Prefer absolute budgets for CI stability; use baselines to catch regressions.
 */

export type BenchStats = {
  name: string;
  iterations: number;
  warmup: number;
  totalMs: number;
  meanMs: number;
  minMs: number;
  maxMs: number;
  p50Ms: number;
  p95Ms: number;
  opsPerSec: number;
};

export type BenchOptions = {
  /** Timed iterations (default 40). */
  iterations?: number;
  /** Untimed warm-up runs (default 5). */
  warmup?: number;
  now?: () => number;
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx]!;
}

/** Time a synchronous function across warm-up + measured iterations. */
export function measureSync(
  name: string,
  fn: () => void,
  opts: BenchOptions = {},
): BenchStats {
  const iterations = opts.iterations ?? 40;
  const warmup = opts.warmup ?? 5;
  const now = opts.now ?? (() => performance.now());

  for (let i = 0; i < warmup; i++) fn();

  const samples: number[] = [];
  const t0 = now();
  for (let i = 0; i < iterations; i++) {
    const a = now();
    fn();
    samples.push(now() - a);
  }
  const totalMs = now() - t0;
  const sorted = [...samples].sort((x, y) => x - y);
  const meanMs = samples.reduce((s, v) => s + v, 0) / samples.length;

  return {
    name,
    iterations,
    warmup,
    totalMs,
    meanMs,
    minMs: sorted[0] ?? 0,
    maxMs: sorted[sorted.length - 1] ?? 0,
    p50Ms: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
    opsPerSec: meanMs > 0 ? 1000 / meanMs : Number.POSITIVE_INFINITY,
  };
}

export type BenchBudget = {
  maxMeanMs?: number;
  maxP95Ms?: number;
  minOpsPerSec?: number;
};

/** Hard absolute ceilings — keep generous enough for CI hosts. */
export function assertBenchBudget(
  stats: BenchStats,
  budget: BenchBudget,
): void {
  const failures: string[] = [];
  if (budget.maxMeanMs != null && stats.meanMs > budget.maxMeanMs) {
    failures.push(
      `mean ${stats.meanMs.toFixed(3)}ms > budget ${budget.maxMeanMs}ms`,
    );
  }
  if (budget.maxP95Ms != null && stats.p95Ms > budget.maxP95Ms) {
    failures.push(
      `p95 ${stats.p95Ms.toFixed(3)}ms > budget ${budget.maxP95Ms}ms`,
    );
  }
  if (budget.minOpsPerSec != null && stats.opsPerSec < budget.minOpsPerSec) {
    failures.push(
      `ops/s ${stats.opsPerSec.toFixed(1)} < min ${budget.minOpsPerSec}`,
    );
  }
  if (failures.length > 0) {
    throw new Error(
      `perf budget failed for "${stats.name}": ${failures.join("; ")}`,
    );
  }
}

/** Assert `fast` is at least `minSpeedup`× faster than `slow` (by mean). */
export function assertFasterThan(
  fast: BenchStats,
  slow: BenchStats,
  minSpeedup = 1.5,
): void {
  const speedup = slow.meanMs / Math.max(fast.meanMs, 1e-9);
  if (speedup < minSpeedup) {
    throw new Error(
      `expected "${fast.name}" ≥ ${minSpeedup}× faster than "${slow.name}" (got ${speedup.toFixed(2)}×; ${fast.meanMs.toFixed(3)}ms vs ${slow.meanMs.toFixed(3)}ms)`,
    );
  }
}

export function formatBenchStats(stats: BenchStats): string {
  return [
    stats.name,
    `n=${stats.iterations}`,
    `mean=${stats.meanMs.toFixed(3)}ms`,
    `p50=${stats.p50Ms.toFixed(3)}ms`,
    `p95=${stats.p95Ms.toFixed(3)}ms`,
    `ops/s=${stats.opsPerSec.toFixed(1)}`,
  ].join(" ");
}
