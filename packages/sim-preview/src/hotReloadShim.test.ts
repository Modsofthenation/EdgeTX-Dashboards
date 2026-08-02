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

  it("shim loadScripts body with Tx mode and bumps via gen", () => {
    const shim = buildHotReloadShimSource("Whoop");
    assert.match(shim, /loadScript\(GEN, "Tx"\)/);
    assert.match(shim, /loadScript\(BODY, "Tx"\)/);
    assert.match(shim, /\/WIDGETS\/Whoop\/body\.lua/);
    assert.match(shim, /local name = "Whoop"/);
    assert.match(shim, /---@simulate Layout1x1 zone=0/);
  });

  it("gen source is a numeric return", () => {
    assert.equal(buildHotReloadGenSource(42).trim(), "return 42");
  });
});
