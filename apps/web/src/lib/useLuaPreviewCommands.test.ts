import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveLuaPreviewPending } from "./useLuaPreviewCommands.ts";

describe("deriveLuaPreviewPending", () => {
  it("marks sourcePending when snapshot source lags", () => {
    const flags = deriveLuaPreviewPending({
      source: "new.lua",
      snapshot: {
        source: "old.lua",
        profileId: "tx15",
        scenarioKey: '{"id":"a"}',
      },
      profileId: "tx15",
      scenarioKey: '{"id":"a"}',
    });
    assert.equal(flags.sourcePending, true);
    assert.equal(flags.pending, true);
  });

  it("clears sourcePending when source matches even if scenario is pending", () => {
    const flags = deriveLuaPreviewPending({
      source: "same.lua",
      snapshot: {
        source: "same.lua",
        profileId: "tx15",
        scenarioKey: '{"id":"armed"}',
      },
      profileId: "tx15",
      scenarioKey: '{"id":"disarmed"}',
    });
    assert.equal(flags.sourcePending, false);
    assert.equal(flags.pending, true);
  });

  it("clears both flags when snapshot matches all inputs", () => {
    const flags = deriveLuaPreviewPending({
      source: "same.lua",
      snapshot: {
        source: "same.lua",
        profileId: "tx15",
        scenarioKey: '{"id":"a"}',
      },
      profileId: "tx15",
      scenarioKey: '{"id":"a"}',
    });
    assert.equal(flags.sourcePending, false);
    assert.equal(flags.pending, false);
  });
});
