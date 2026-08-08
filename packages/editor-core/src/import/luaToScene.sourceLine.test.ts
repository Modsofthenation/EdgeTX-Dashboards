import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { luaToScene } from "./luaToScene.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const starter = readFileSync(
  join(repoRoot, "examples/tx15-minimal-dashboard.lua"),
  "utf8",
);

describe("luaToScene sourceLine bridge", () => {
  it("stashes sourceLine on imported elements for record selection", () => {
    const { scene, warnings } = luaToScene(starter);
    assert.ok(scene.elements.length > 0);
    const withLine = scene.elements.filter((e) => e.sourceLine != null);
    assert.ok(withLine.length > 0);
    for (const el of withLine) {
      assert.equal(typeof el.sourceLine, "number");
      assert.ok((el.sourceLine as number) >= 1);
    }
    assert.ok(Array.isArray(warnings));
  });
});
