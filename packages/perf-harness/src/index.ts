export {
  measureSync,
  assertBenchBudget,
  assertFasterThan,
  formatBenchStats,
  type BenchStats,
  type BenchOptions,
  type BenchBudget,
} from "./bench.ts";

export {
  loadBaselineFile,
  saveBaselineFile,
  emptyBaselineFile,
  entryFromStats,
  assertNoRegression,
  shouldUpdateBaselines,
  defaultMaxRegression,
  type BaselineEntry,
  type BaselineFile,
  type RegressionCheckOptions,
} from "./baseline.ts";
