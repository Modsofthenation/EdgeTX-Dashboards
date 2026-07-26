import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getLayoutTemplateBoardSource,
  isLayoutTemplateBoardId,
  type LayoutTemplateBoardId,
} from "./templateBoards.ts";

const BOARD_IDS: LayoutTemplateBoardId[] = [
  "starter",
  "minimal",
  "minimal-quad",
  "dense-crsf",
  "whoop",
  "freestyle-quad",
  "battery-tool",
  "flight-logger",
];

describe("templateBoards", () => {
  it("resolves a complete board for every gallery board id", () => {
    for (const id of BOARD_IDS) {
      assert.equal(isLayoutTemplateBoardId(id), true);
      const source = getLayoutTemplateBoardSource(id);
      assert.match(source, /---@type WidgetScript/);
      assert.match(source, /function refresh\(/);
      assert.match(source, /lcd\.draw/);
      assert.ok(
        source.includes("drawFilledRectangle") || source.includes("drawText"),
        `${id} should draw UI`,
      );
      // More than header-only stub
      const drawCount = (source.match(/lcd\.draw/g) ?? []).length;
      assert.ok(drawCount >= 6, `${id} expected richer board, got ${drawCount} draws`);
    }
  });

  it("falls back to starter for unknown ids", () => {
    const source = getLayoutTemplateBoardSource("not-a-real-board");
    assert.match(source, /DashStart|MINIMAL|name =/);
    assert.match(source, /function refresh\(/);
  });
});
