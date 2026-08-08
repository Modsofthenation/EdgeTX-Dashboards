import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createEmptyScene, sceneToLua } from "@widget-gen/editor-core";

describe("editor smoke", () => {
  it("sceneToLua produces refresh with lcd.clear", () => {
    const lua = sceneToLua(createEmptyScene("SmokeTest"));
    assert.match(lua, /local function refresh/);
    assert.match(lua, /lcd\.clear\(BLACK\)/);
    assert.match(lua, /name = "SmokeTest"/);
  });
});
