import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { buildGenerationPrompt } from "./promptComposer.ts";
import { createCustomTools } from "./agentTools.ts";
import { loadRadioProfile, loadTelemetryCatalog } from "./knowledge.ts";
import {
  getGeneratedDirForKey,
  getWidgetLuaPathForKey,
  sanitizeWidgetInstanceId,
} from "./paths.ts";

describe("buildGenerationPrompt prefab-first", () => {
  it("injects live prefab catalog and compose task for heli-rotorflight", () => {
    const radio = loadRadioProfile("tx15");
    const catalog = loadTelemetryCatalog("rotorflight");
    const prompt = buildGenerationPrompt(
      "Rotorflight heli electric board with headspeed and governor",
      radio,
      catalog,
      undefined,
      {
        sessionId: "test-prefab-heli",
        assignedWidgetName: "RfHeli1",
        widgetInstanceId: "11111111-1111-4111-8111-111111111111",
      },
    );
    assert.match(prompt, /composeWidgetFromPrefabs/);
    assert.match(prompt, /rf-headspeed-hero/);
    assert.match(prompt, /Prefab-first/);
    assert.match(prompt, /Live prefab catalog/);
  });

  it("injects quad board recipes for whoop overview", () => {
    const radio = loadRadioProfile("tx15");
    const catalog = loadTelemetryCatalog("betaflight");
    const prompt = buildGenerationPrompt(
      "Tiny whoop quad overview with armed banner and voltage hero",
      radio,
      catalog,
      undefined,
      {
        sessionId: "test-prefab-whoop",
        assignedWidgetName: "Whoop1",
        widgetInstanceId: "22222222-2222-4222-8222-222222222222",
      },
    );
    assert.match(prompt, /composeWidgetFromPrefabs/);
    assert.match(prompt, /quad-armed-banner|Whoop/);
  });

  it("passes color272 lcd size into prefab-first task for TX16", () => {
    const radio = loadRadioProfile("tx16");
    const catalog = loadTelemetryCatalog("rotorflight");
    const prompt = buildGenerationPrompt(
      "Rotorflight heli board for TX16",
      radio,
      catalog,
      undefined,
      {
        sessionId: "test-prefab-tx16",
        assignedWidgetName: "RfTx16",
        widgetInstanceId: "33333333-3333-4333-8333-333333333333",
      },
    );
    assert.match(prompt, /lcdW=480/);
    assert.match(prompt, /lcdH=272/);
  });
});

describe("composeWidgetFromPrefabs tool", () => {
  it("writes a whoop board into the workspace", async () => {
    const id = sanitizeWidgetInstanceId(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
    const dir = getGeneratedDirForKey(id);
    mkdirSync(dir, { recursive: true });
    try {
      const tools = createCustomTools({
        protocol: "betaflight",
        radioId: "tx15",
        widgetInstanceId: id,
        widgetName: "WhoopT",
      });
      const result = await tools.composeWidgetFromPrefabs.execute(
        {
          widgetInstanceId: id,
          prefabIds: [
            "quad-armed-banner",
            "quad-link-batt-bars",
            "quad-voltage-hero",
            "quad-attitude-card",
            "quad-capacity-chip",
            "quad-mode-footer",
          ],
          displayName: "WhoopT",
        },
        { toolCallId: "test-compose" },
      );
      assert.equal(typeof result, "string");
      const parsed = JSON.parse(String(result));
      assert.equal(parsed.success, true);
      assert.ok(parsed.inserted.includes("quad-voltage-hero"));
      const path = getWidgetLuaPathForKey(id);
      assert.ok(existsSync(path));
      const lua = readFileSync(path, "utf-8");
      assert.match(lua, /-- prefab:quad-voltage-hero/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
