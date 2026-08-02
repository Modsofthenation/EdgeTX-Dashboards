import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import type { BenchStats } from "./bench.ts";

export type BaselineEntry = {
  meanMs: number;
  p95Ms: number;
  opsPerSec: number;
  updatedAt: string;
};

export type BaselineFile = {
  version: 1;
  suites: Record<string, BaselineEntry>;
};

export function emptyBaselineFile(): BaselineFile {
  return { version: 1, suites: {} };
}

export function loadBaselineFile(path: string): BaselineFile {
  if (!existsSync(path)) return emptyBaselineFile();
  const raw = JSON.parse(readFileSync(path, "utf8")) as BaselineFile;
  if (raw.version !== 1 || typeof raw.suites !== "object" || !raw.suites) {
    throw new Error(`Invalid perf baseline file: ${path}`);
  }
  return raw;
}

export function saveBaselineFile(path: string, data: BaselineFile): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function entryFromStats(stats: BenchStats): BaselineEntry {
  return {
    meanMs: Number(stats.meanMs.toFixed(4)),
    p95Ms: Number(stats.p95Ms.toFixed(4)),
    opsPerSec: Number(stats.opsPerSec.toFixed(2)),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Default regression allowance (mean/p95 may be this much slower than baseline).
 * `PERF_STRICT=1` tightens to 25%.
 */
export function defaultMaxRegression(): number {
  return process.env.PERF_STRICT === "1" ? 0.25 : 1.0;
}

export function shouldUpdateBaselines(): boolean {
  return (
    process.env.UPDATE_PERF_BASELINES === "1" ||
    process.env.UPDATE_PERF_BASELINES === "true"
  );
}

export type RegressionCheckOptions = {
  baselinePath: string;
  suiteKey: string;
  /** Fraction over baseline mean that still passes (default from env). */
  maxMeanRegression?: number;
  maxP95Regression?: number;
};

/**
 * Compare against a committed baseline. With UPDATE_PERF_BASELINES=1, writes
 * the new sample instead of asserting (use after intentional speedups).
 */
export function assertNoRegression(
  stats: BenchStats,
  opts: RegressionCheckOptions,
): void {
  const file = loadBaselineFile(opts.baselinePath);
  const key = opts.suiteKey;

  if (shouldUpdateBaselines()) {
    file.suites[key] = entryFromStats(stats);
    saveBaselineFile(opts.baselinePath, file);
    return;
  }

  const baseline = file.suites[key];
  if (!baseline) {
    // First run without a baseline: record it so the next commit can include it.
    file.suites[key] = entryFromStats(stats);
    saveBaselineFile(opts.baselinePath, file);
    return;
  }

  const maxMean = opts.maxMeanRegression ?? defaultMaxRegression();
  const maxP95 = opts.maxP95Regression ?? defaultMaxRegression();

  const meanLimit = baseline.meanMs * (1 + maxMean);
  const p95Limit = baseline.p95Ms * (1 + maxP95);
  const failures: string[] = [];

  if (stats.meanMs > meanLimit) {
    failures.push(
      `mean ${stats.meanMs.toFixed(3)}ms > ${meanLimit.toFixed(3)}ms (baseline ${baseline.meanMs}ms + ${(maxMean * 100).toFixed(0)}%)`,
    );
  }
  if (stats.p95Ms > p95Limit) {
    failures.push(
      `p95 ${stats.p95Ms.toFixed(3)}ms > ${p95Limit.toFixed(3)}ms (baseline ${baseline.p95Ms}ms + ${(maxP95 * 100).toFixed(0)}%)`,
    );
  }

  if (failures.length > 0) {
    throw new Error(
      `perf regression for "${stats.name}" [${key}]: ${failures.join("; ")}. ` +
        `If this is an intentional change, re-run with UPDATE_PERF_BASELINES=1.`,
    );
  }
}
