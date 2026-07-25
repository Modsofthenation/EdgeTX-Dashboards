import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  commitVersionSnapshot,
  resolveDisplayArtifact,
  resolveLatestVersion,
} from "../artifactVersionHistory.ts";
import type { WidgetSnapshot, WidgetVersionEntry } from "../chatTypes.ts";

const luaV0 = 'local name = "Test"\n-- v0';
const luaV1 = 'local name = "Test"\n-- v1';

function snap(version: number, lua: string): WidgetSnapshot {
  return {
    name: "Test",
    instanceId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    version,
    luaSource: lua,
    validated: true,
    validationIssues: [],
  };
}

describe("artifactVersionHistory", () => {
  it("resolveDisplayArtifact never falls back to latest when viewing older version", () => {
    const head = snap(1, luaV1);
    const history: WidgetVersionEntry[] = [
      {
        version: 0,
        name: "Test",
        instanceId: head.instanceId,
        luaSource: luaV0,
        validated: true,
        validationIssues: [],
        createdAt: 1,
      },
    ];

    const displayed = resolveDisplayArtifact(0, 1, head, history);
    assert.ok(displayed?.luaSource?.includes("v0"));
    assert.ok(!displayed?.luaSource?.includes("v1"));
  });

  it("commitVersionSnapshot keeps first lua for a version (immutable)", () => {
    let history: WidgetVersionEntry[] = [];
    history = commitVersionSnapshot(history, snap(0, luaV0));
    history = commitVersionSnapshot(history, snap(0, luaV1));
    assert.equal(history[0]?.luaSource, luaV0);
  });

  it("commitVersionSnapshot adds new version entries", () => {
    let history: WidgetVersionEntry[] = [];
    history = commitVersionSnapshot(history, snap(0, luaV0));
    history = commitVersionSnapshot(history, snap(1, luaV1));
    assert.equal(resolveLatestVersion(snap(1, luaV1), history), 1);
    assert.equal(history.length, 2);
  });
});
