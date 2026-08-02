import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  assertBenchBudget,
  assertNoRegression,
  formatBenchStats,
  measureSync,
  createStarterSource,
  insertDrawLine,
  interpretDocument,
  moveRecordLinesToEdge,
  translateRecord,
} from "./perfImports.ts";

const here = dirname(fileURLToPath(import.meta.url));
const baselinePath = join(here, "../baselines/editor-core.json");

function boardWithShapes() {
  let source = createStarterSource();
  source = insertDrawLine(source, "rect");
  source = insertDrawLine(source, "circle");
  source = insertDrawLine(source, "line");
  source = insertDrawLine(source, "filledRect");
  source = insertDrawLine(source, "text");
  return source;
}

describe("perf: editor-core document ops", () => {
  it("interpretDocument on multi-shape board stays within budget", () => {
    const source = boardWithShapes();
    const stats = measureSync(
      "interpretDocument(multi)",
      () => {
        interpretDocument(source);
      },
      { iterations: 40, warmup: 5 },
    );
    // eslint-disable-next-line no-console
    console.log(formatBenchStats(stats));
    assertBenchBudget(stats, { maxMeanMs: 40, maxP95Ms: 80 });
    assertNoRegression(stats, {
      baselinePath,
      suiteKey: "interpretDocument.multi",
    });
  });

  it("moveRecordLinesToEdge is cheaper than repeated interpret loops", () => {
    const source = boardWithShapes();
    const records = interpretDocument(source);
    const selected = records.slice(0, 3);
    assert.ok(selected.length >= 2);

    const batch = measureSync(
      "moveRecordLinesToEdge",
      () => {
        moveRecordLinesToEdge(source, selected, "front");
      },
      { iterations: 40, warmup: 5 },
    );
    // eslint-disable-next-line no-console
    console.log(formatBenchStats(batch));
    assertBenchBudget(batch, { maxMeanMs: 15, maxP95Ms: 40 });
    assertNoRegression(batch, {
      baselinePath,
      suiteKey: "moveRecordLinesToEdge.front",
    });
  });

  it("translateRecord on one anchored record stays cheap", () => {
    const source = boardWithShapes();
    const record = interpretDocument(source).find((r) => r.kind === "rect");
    assert.ok(record?.sourceRef);
    const zone = { zoneX: 0, zoneY: 0, zoneW: 480, zoneH: 272 };
    const stats = measureSync(
      "translateRecord",
      () => {
        translateRecord(source, record!, 2, 1, zone);
      },
      { iterations: 60, warmup: 5 },
    );
    // eslint-disable-next-line no-console
    console.log(formatBenchStats(stats));
    assertBenchBudget(stats, { maxMeanMs: 10, maxP95Ms: 25 });
    assertNoRegression(stats, {
      baselinePath,
      suiteKey: "translateRecord.rect",
    });
  });
});
