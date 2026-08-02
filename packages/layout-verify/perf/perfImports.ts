/**
 * Local re-exports so perf suites can import harness + package APIs in one place
 * without relying on workspace resolution quirks under strip-types.
 */
export {
  assertBenchBudget,
  assertFasterThan,
  assertNoRegression,
  formatBenchStats,
  measureSync,
} from "@widget-gen/perf-harness";
export {
  clearStaticParseCache,
  parseLuaToDrawCommands,
  parseLuaToDrawCommandsStatic,
} from "../src/index.ts";
