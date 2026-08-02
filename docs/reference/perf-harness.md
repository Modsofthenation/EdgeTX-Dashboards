# Performance harness

Programmatic micro-benchmarks for editor/preview hotspots. Suites live in
`**/perf/*.perf.test.ts` and are **not** part of default `npm test` globs.

## Commands

```bash
npm run test:perf
UPDATE_PERF_BASELINES=1 npm run test:perf   # refresh committed baselines after intentional wins
PERF_STRICT=1 npm run test:perf               # fail on >25% mean/p95 regression (default allowance is 100%)
```

Package under test: `@widget-gen/perf-harness` (`measureSync`, `assertBenchBudget`, `assertNoRegression`).

## What is covered

| Suite                         | Guards                                                            |
| ----------------------------- | ----------------------------------------------------------------- |
| `packages/layout-verify/perf` | Gold-example interpret budget + static parse cache speedup        |
| `packages/editor-core/perf`   | Multi-shape interpret, `moveRecordLinesToEdge`, `translateRecord` |
| `apps/web/perf`               | Frame throttle emit count (~30 from 60), capped `unifiedDiff`     |

Baselines are JSON under each package’s `baselines/` folder. Absolute budgets
are generous for CI; baselines catch regressions relative to this environment.

## Adding a suite

1. Put `something.perf.test.ts` under `perf/` (not `src/`).
2. Import helpers from `@widget-gen/perf-harness` (via a local `perfImports.ts` if useful).
3. Call `assertBenchBudget` (hard ceiling) and `assertNoRegression` (baseline).
4. Run `UPDATE_PERF_BASELINES=1 npm run test:perf` once and commit the JSON.
