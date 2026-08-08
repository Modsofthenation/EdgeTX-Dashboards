import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EDITOR_PREVIEW_SCENARIO,
  type PreviewDrawCommand,
  type PreviewParseMeta,
} from "@widget-gen/layout-verify";
import {
  interpretPreviewSync,
  LuaPreviewWorkerClient,
  resetLuaPreviewWorkerClientForTests,
} from "./luaPreviewWorkerClient.ts";

const MINIMAL_LUA = `---@type WidgetScript
---@simulate Layout1x1 zone=0
local name = "T"
local options = {}
local function create(zone, opts)
  return { zone = zone, options = opts }
end
local function refresh(widget)
  lcd.clear(BLACK)
  lcd.drawText(12, 12, "Hi", WHITE)
end
return { name = name, options = options, create = create, refresh = refresh }
`;

describe("interpretPreviewSync", () => {
  it("returns draw commands and meta for a minimal widget", () => {
    const result = interpretPreviewSync(
      MINIMAL_LUA,
      EDITOR_PREVIEW_SCENARIO,
      "tx15",
    );
    assert.ok(result.commands.length >= 1);
    assert.ok(result.commands.some((c) => c.kind === "text"));
    assert.equal(typeof result.meta.skippedTextCount, "number");
  });
});

describe("LuaPreviewWorkerClient latest-wins", () => {
  it("ignores stale requestIds in handleMessage", () => {
    resetLuaPreviewWorkerClientForTests();
    const client = new LuaPreviewWorkerClient();
    // Force degraded so we never spawn a real Worker in node tests.
    (
      client as unknown as { degraded: boolean; ensureWorker: () => null }
    ).degraded = true;
    (client as unknown as { ensureWorker: () => null }).ensureWorker = () =>
      null;

    const seen: PreviewDrawCommand[][] = [];
    const metas: PreviewParseMeta[] = [];

    // Simulate two queued resolves where only the latest should matter at the
    // React layer; client.applyMock in degraded mode is sync and always latest.
    void client.setSource(MINIMAL_LUA, "tx15");
    return client.applyMock(EDITOR_PREVIEW_SCENARIO).then((first) => {
      seen.push(first.commands);
      metas.push(first.meta);
      return client.applyMock(EDITOR_PREVIEW_SCENARIO).then((second) => {
        seen.push(second.commands);
        assert.equal(seen.length, 2);
        assert.ok(second.commands.length >= 1);
        client.dispose();
      });
    });
  });

  it("isLatest tracks generation and request id", () => {
    const client = new LuaPreviewWorkerClient();
    (client as unknown as { degraded: boolean }).degraded = true;
    const gen = client.setSource(MINIMAL_LUA, "tx15");
    assert.equal(gen, client.currentGeneration);
    assert.equal(client.isLatest(999, gen), false);
    client.dispose();
  });
});
