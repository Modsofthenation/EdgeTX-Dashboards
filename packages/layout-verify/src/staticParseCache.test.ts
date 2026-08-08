import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearStaticParseCache,
  parseLuaToDrawCommands,
  parseLuaToDrawCommandsStatic,
} from "./index.ts";

const SAMPLE = `---@type WidgetScript
---@simulate Layout1x1 zone=0
local name = "Cache"
local function create(zone, opts) return { zone = zone } end
local function refresh(widget)
  lcd.clear(BLACK)
  lcd.drawText(12, 12, "Hi", WHITE)
end
return { name = name, create = create, refresh = refresh }
`;

describe("static parse cache", () => {
  it("reuses the same static parse object for identical source", () => {
    clearStaticParseCache();
    const a = parseLuaToDrawCommandsStatic(SAMPLE);
    const b = parseLuaToDrawCommandsStatic(SAMPLE);
    assert.ok(a);
    assert.equal(a, b);
    assert.ok(a!.rawBodyLines.length > 0);
    assert.ok(a!.indentBySourceLine.length > 0);
  });

  it("still produces draw commands after caching", () => {
    clearStaticParseCache();
    const cmds = parseLuaToDrawCommands(SAMPLE);
    assert.ok(cmds.some((c) => c.kind === "text"));
  });
});
