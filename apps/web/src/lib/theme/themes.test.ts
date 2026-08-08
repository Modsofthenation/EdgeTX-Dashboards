import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_THEME,
  THEME_IDS,
  THEME_OPTIONS,
  isThemeId,
} from "./themes.ts";

describe("themes", () => {
  it("lists every theme id in THEME_OPTIONS exactly once", () => {
    assert.equal(THEME_OPTIONS.length, THEME_IDS.length);
    const ids = THEME_OPTIONS.map((o) => o.id);
    assert.deepEqual([...ids].sort(), [...THEME_IDS].sort());
    assert.equal(new Set(ids).size, ids.length);
  });

  it("gives every option a label and description", () => {
    for (const option of THEME_OPTIONS) {
      assert.ok(option.label.trim().length > 0, option.id);
      assert.ok(option.description.trim().length > 0, option.id);
    }
  });

  it("recognizes known ids and rejects unknown ones", () => {
    assert.equal(isThemeId(DEFAULT_THEME), true);
    assert.equal(isThemeId("volt"), true);
    assert.equal(isThemeId("copper"), true);
    assert.equal(isThemeId("aurora"), true);
    assert.equal(isThemeId("candy"), true);
    assert.equal(isThemeId("not-a-theme"), false);
    assert.equal(isThemeId(null), false);
  });
});
