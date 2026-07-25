import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildArtifactContext,
  buildConversationSummary,
  buildRefineHistorySections,
} from "./refineHistory.ts";

const SAMPLE_LUA_V0 = `local name = "TestDash"
local function create() return {} end
local function refresh() lcd.clear(BLACK) end
return { name = name, create = create, refresh = refresh }`;

const SAMPLE_LUA_V1 = `local name = "TestDash"
local function create() return { colors = {} } end
local function refresh() lcd.clear(BLACK) lcd.drawText(4, 4, "HI", 0) end
return { name = name, create = create, refresh = refresh }`;

describe("buildConversationSummary", () => {
  it("lists prior user and assistant turns excluding the current prompt", () => {
    const summary = buildConversationSummary({
      messages: [
        { role: "user", content: "Tinywhoop dash" },
        { role: "assistant", content: "Generated hero-minimal dashboard." },
        { role: "user", content: "Add model image background" },
        { role: "assistant", content: "Added full-screen model image with dim overlay." },
        { role: "user", content: "Make link bars thicker" },
      ],
      currentPrompt: "Make link bars thicker",
      artifact: null,
      artifactVersions: [],
    });

    assert.match(summary, /Tinywhoop dash/);
    assert.match(summary, /model image background/);
    assert.match(summary, /hero-minimal/);
    assert.doesNotMatch(summary, /Make link bars thicker/);
  });
});

describe("buildArtifactContext", () => {
  it("includes full current lua and prior version snapshots", () => {
    const context = buildArtifactContext({
      messages: [],
      currentPrompt: "refine",
      artifact: { version: 1, luaSource: SAMPLE_LUA_V1, validated: true },
      artifactVersions: [{ version: 0, luaSource: SAMPLE_LUA_V0, validated: true }],
      workspaceLuaSource: SAMPLE_LUA_V1,
    });

    assert.match(context, /### Current widget source \(v1\)/);
    assert.match(context, /lcd\.drawText/);
    assert.match(context, /### Prior design snapshots/);
    assert.match(context, /#### v0/);
    assert.match(context, /local name = "TestDash"/);
  });
});

describe("buildRefineHistorySections", () => {
  it("returns both conversation and artifact sections", () => {
    const sections = buildRefineHistorySections({
      messages: [{ role: "user", content: "first prompt" }],
      currentPrompt: "second prompt",
      artifact: { version: 0, luaSource: SAMPLE_LUA_V0, validated: true },
      artifactVersions: [],
    });

    assert.ok(sections.conversationSummary.includes("first prompt"));
    assert.ok(sections.artifactContext.includes("Current widget source"));
  });
});
