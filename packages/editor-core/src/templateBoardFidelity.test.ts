import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  EDITOR_PREVIEW_SCENARIO,
  parseLuaToDrawCommands,
  isInterpretationReliable,
  getLastPreviewParseMeta,
} from "@widget-gen/layout-verify";
import {
  getLayoutTemplateBoardIds,
  getLayoutTemplateBoardSource,
} from "./templateBoards.ts";

describe("template boards — parser fidelity for editor preview", () => {
  for (const id of getLayoutTemplateBoardIds()) {
    it(`${id} produces reliable visible draw records`, () => {
      const source = getLayoutTemplateBoardSource(id);
      const records = parseLuaToDrawCommands(source, EDITOR_PREVIEW_SCENARIO);
      const meta = getLastPreviewParseMeta();
      assert.ok(
        records.length > 2,
        `${id}: expected draws, got ${records.length}`,
      );
      assert.ok(
        records.some(
          (r) =>
            r.kind === "filledRect" ||
            r.kind === "text" ||
            r.kind === "rect" ||
            r.kind === "annulus" ||
            r.kind === "gauge",
        ),
        `${id}: expected visible kinds`,
      );
      assert.ok(
        isInterpretationReliable(records, meta.skippedTextCount),
        `${id}: unreliable (skipped=${meta.skippedTextCount}) ${meta.warnings.slice(0, 2).join("; ")}`,
      );
    });
  }
});
