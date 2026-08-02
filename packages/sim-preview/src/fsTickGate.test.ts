import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createFsTickGate } from "./fsTickGate.ts";

describe("createFsTickGate", () => {
  it("blocks tryBeginTick while FS exclusive is held", async () => {
    const gate = createFsTickGate();
    await gate.beginFsExclusive();
    assert.equal(gate.tryBeginTick(), false);
    assert.ok(gate.fsGate());
    gate.endFsExclusive();
    assert.equal(gate.tryBeginTick(), true);
    gate.endTick();
  });

  it("beginFsExclusive waits for an in-flight tick to finish", async () => {
    const gate = createFsTickGate();
    assert.equal(gate.tryBeginTick(), true);

    let exclusiveStarted = false;
    const exclusive = gate.beginFsExclusive().then(() => {
      exclusiveStarted = true;
    });

    await new Promise((r) => setTimeout(r, 5));
    assert.equal(exclusiveStarted, false);

    gate.endTick();
    await exclusive;
    assert.equal(exclusiveStarted, true);
    gate.endFsExclusive();
  });

  it("runLoop can await fsGate then proceed", async () => {
    const gate = createFsTickGate();
    await gate.beginFsExclusive();

    let proceeded = false;
    const loop = (async () => {
      const pending = gate.fsGate();
      assert.ok(pending);
      await pending;
      assert.equal(gate.tryBeginTick(), true);
      proceeded = true;
      gate.endTick();
    })();

    await new Promise((r) => setTimeout(r, 5));
    assert.equal(proceeded, false);
    gate.endFsExclusive();
    await loop;
    assert.equal(proceeded, true);
  });
});
