import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildVirtualSdPaths,
  extractWidgetName,
  planWidgetDeploy,
  sanitizeWidgetFolderName,
  SIM_MODEL_BITMAP,
} from "../virtualSd.ts";

describe("virtualSd", () => {
  it("extracts widget name from Lua return", () => {
    const source = 'return { name = "BfModel", create = function() end }';
    assert.equal(extractWidgetName(source), "BfModel");
  });

  it("builds WIDGETS paths", () => {
    const paths = buildVirtualSdPaths("BfModel");
    assert.equal(paths.luaPath, "/WIDGETS/BfModel/main.lua");
    assert.equal(paths.modelPngPath, `/IMAGES/${SIM_MODEL_BITMAP}`);
  });

  it("planWidgetDeploy uses parsed name", () => {
    const source = '---@type WidgetScript\nreturn { name = "BfModelDt8" }';
    const plan = planWidgetDeploy(source);
    assert.equal(plan.widgetName, "BfModelDt8");
    assert.equal(plan.paths.luaPath, "/WIDGETS/BfModelDt8/main.lua");
  });

  it("rejects invalid folder names", () => {
    assert.throws(() => sanitizeWidgetFolderName("too-long-name-here"), /Invalid widget name/);
  });
});
