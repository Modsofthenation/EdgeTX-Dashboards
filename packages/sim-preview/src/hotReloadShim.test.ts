import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildHotReloadGenSource,
  buildHotReloadShimSource,
  hotReloadPaths,
} from "./hotReloadShim.ts";

describe("hotReloadShim", () => {
  it("builds absolute body/gen paths under WIDGETS/<Name>", () => {
    const paths = hotReloadPaths("Whoop");
    assert.equal(paths.shimPath, "/WIDGETS/Whoop/main.lua");
    assert.equal(paths.bodyPath, "/WIDGETS/Whoop/body.lua");
    assert.equal(paths.genPath, "/WIDGETS/Whoop/gen.lua");
  });

  it("shim polls gen from refresh and caches mod for update/background", () => {
    const shim = buildHotReloadShimSource("Whoop");
    assert.match(shim, /local function checkReload\(\)/);
    assert.match(shim, /loadScript\(GEN, "Tx"\)/);
    assert.match(shim, /loadScript\(BODY, "Tx"\)/);
    assert.match(shim, /\/WIDGETS\/Whoop\/body\.lua/);
    const updateFn = shim.match(
      /local function update\(widget, opts\)\n([\s\S]*?)\nend\n\nlocal function refresh/,
    )?.[1];
    const backgroundFn = shim.match(
      /local function background\(widget\)\n([\s\S]*?)\nend\n\nreturn \{/,
    )?.[1];
    const refreshFn = shim.match(
      /local function refresh\(widget, event, touch\)\n([\s\S]*?)\nend\n\nlocal function background/,
    )?.[1];
    assert.ok(updateFn);
    assert.ok(backgroundFn);
    assert.ok(refreshFn);
    assert.match(refreshFn!, /checkReload\(\)/);
    assert.doesNotMatch(updateFn!, /checkReload/);
    assert.doesNotMatch(backgroundFn!, /checkReload/);
    assert.match(updateFn!, /mod\.update/);
  });

  it("gen source is a numeric return", () => {
    assert.equal(buildHotReloadGenSource(42).trim(), "return 42");
  });
});
